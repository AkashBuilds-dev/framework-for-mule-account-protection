"""
==============================================================================
MuleShield (SIH26184) - Module E: Case Management & Closed-Loop Feedback
==============================================================================
Provides full lifecycle cybercrime case management:
- POST /api/cases/new: Automated entity resolution, cashout forecasting & triage
- GET /api/cases: Searchable and filterable case docket
- GET /api/cases/{case_id}: Complete forensic dossier
- POST /api/cases/{case_id}/feedback: Closed-loop investigator feedback
==============================================================================
"""

import asyncio
from datetime import datetime
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, HTTPException, Query

from backend.api import state
from backend.api.entity_resolver import resolve_entities
from backend.api.models_integration import predict_cashout_zones_internal
from backend.api.schemas import (
    CaseCreateRequest,
    CaseFeedbackRequest,
    CaseResponse,
    CashoutZoneItem,
)
from backend.api.utils import (
    evaluate_escalation_matrix,
    generate_alert_id,
    generate_case_id,
    generate_freeze_id,
    get_current_timestamp,
)
from backend.api.websocket_hub import ws_hub

router = APIRouter(prefix="/api/cases", tags=["Case Management & Forensics"])


@router.post(
    "/new",
    response_model=CaseResponse,
    status_code=201,
    summary="Create Investigation Case with Auto-Resolved Graph & Spatial Forecast",
)
async def create_case(payload: CaseCreateRequest):
    """
    Creates an investigation case from an incoming cyber fraud complaint.
    Automatically:
    1. Traverses the multi-hop NetworkX transaction graph to resolve the suspect's fraud entity.
    2. Runs spatial inference to forecast top 5 cash-out ATM clusters.
    3. Evaluates the 4-tier Escalation Matrix (CRITICAL/HIGH/MEDIUM/LOW).
    4. Automatically generates active alerts and bank freeze suggestions if high severity.
    5. Multicasts live updates via WebSocket to connected investigators.
    """
    suspect_id = payload.suspect_account_id.strip()
    if not suspect_id:
        raise HTTPException(status_code=400, detail="Suspect account ID is required.")

    case_id = generate_case_id()
    created_at = get_current_timestamp()

    # 1. Multi-hop Entity Resolution
    resolved = resolve_entities(suspect_id)
    risk_score = float(resolved.get("risk_score", 95.0))

    # 2. Escalation Matrix Evaluation
    escalation = evaluate_escalation_matrix(risk_score, payload.amount_lost)

    # 3. Spatial Cash-Out Prediction
    try:
        predicted_zones_raw = predict_cashout_zones_internal(
            payload.victim_lat, payload.victim_lon, payload.amount_lost, created_at
        )
        predicted_zones = [CashoutZoneItem(**z) for z in predicted_zones_raw]
    except Exception as exc:
        state.append_system_log("WARNING", f"Failed cash-out prediction during case creation: {exc}")
        predicted_zones = []

    case_obj = {
        "case_id": case_id,
        "status": "UNDER_INVESTIGATION",
        "created_at": created_at,
        "victim_info": {
            "name": payload.victim_name or "Anonymous Complainant",
            "phone": payload.victim_phone or "N/A",
            "city": payload.victim_city,
            "lat": payload.victim_lat,
            "lon": payload.victim_lon,
            "amount_lost": payload.amount_lost,
            "fraud_type": payload.fraud_type,
            "notes": payload.complaint_notes or "",
        },
        "suspect_info": {
            "account_id": suspect_id,
            "risk_score": risk_score,
        },
        "resolved_entity": resolved,
        "predicted_cashout_zones": [z.dict() for z in predicted_zones],
        "escalation_status": escalation,
        "feedback": None,
    }

    # Store in-memory
    state.CASES[case_id] = case_obj

    # If Critical or High, spawn alert
    new_alert_obj = None
    if escalation["severity"] in ["CRITICAL", "HIGH"]:
        alert_id = generate_alert_id()
        new_alert_obj = {
            "alert_id": alert_id,
            "case_id": case_id,
            "account_id": suspect_id,
            "risk_score": risk_score,
            "amount": payload.amount_lost,
            "severity": escalation["severity"],
            "escalation": escalation,
            "status": "ACTIVE",
            "created_at": created_at,
            "acknowledged_at": None,
            "acknowledged_by": None,
        }
        state.ALERTS.insert(0, new_alert_obj)

    # If Critical, auto-suggest bank freeze in queue
    if escalation["severity"] == "CRITICAL":
        freeze_id = generate_freeze_id()
        predicted_win = "14:45 to 15:45"
        if predicted_zones and len(predicted_zones) > 0:
            predicted_win = predicted_zones[0].predicted_withdrawal_window

        freeze_item = {
            "freeze_id": freeze_id,
            "account_id": suspect_id,
            "case_id": case_id,
            "bank_name": "State Bank of India",
            "risk_score": risk_score,
            "amount_at_risk": payload.amount_lost,
            "victim_amount": payload.amount_lost,
            "severity": escalation["severity"],
            "predicted_cashout_window": predicted_win,
            "status": "PENDING_BANK_APPROVAL",
            "freeze_reference_no": f"LEA-WARRANT-{freeze_id}",
            "timestamp": created_at,
            "time_since": "Just now",
            "requested_by": "Cybercrime Emergency Unit",
            "message": f"Preemptive debit freeze request generated under escalation protocol ({escalation['severity']}).",
        }
        state.FREEZE_QUEUE.insert(0, freeze_item)
        # Broadcast to bank dashboard immediately
        asyncio.create_task(
            ws_hub.broadcast(
                "FREEZE_APPROVED",
                {"freeze_id": freeze_id, "status": "REQUESTED", "item": freeze_item},
                roles=["bank", "investigator", "admin"],
            )
        )

    # Record Audit Log
    state.add_audit_log(
        action="CASE_CREATED",
        entity_type="CASE",
        entity_id=case_id,
        user="INVESTIGATOR",
        details={
            "amount": payload.amount_lost,
            "suspect_id": suspect_id,
            "city": payload.victim_city,
            "severity": escalation["severity"],
        },
    )

    # Multicast WebSocket updates in background
    asyncio.create_task(ws_hub.broadcast("CASE_UPDATED", {"case_id": case_id, "action": "CREATED", "case": case_obj}))
    if new_alert_obj:
        asyncio.create_task(ws_hub.broadcast("NEW_ALERT", new_alert_obj))

    return CaseResponse(**case_obj)


@router.get(
    "",
    response_model=List[CaseResponse],
    summary="List Investigation Cases (Filterable)",
)
def list_cases(
    status: Optional[str] = Query(None, description="Filter by status: UNDER_INVESTIGATION, CONFIRMED_FRAUD, FALSE_POSITIVE, RESOLVED"),
    city: Optional[str] = Query(None, description="Filter by victim city"),
    date_from: Optional[str] = Query(None, description="Filter by start date (YYYY-MM-DD)"),
    date_to: Optional[str] = Query(None, description="Filter by end date (YYYY-MM-DD)"),
):
    """
    Returns all registered cybercrime cases, sorted by creation timestamp descending.
    Supports filtering by investigation status, victim city, or incident date range.
    """
    results = list(state.CASES.values())

    if status:
        results = [c for c in results if c["status"].upper() == status.upper()]

    if city:
        results = [c for c in results if c["victim_info"]["city"].lower() == city.lower()]

    if date_from:
        results = [c for c in results if c["created_at"] >= date_from]

    if date_to:
        results = [c for c in results if c["created_at"] <= f"{date_to} 23:59:59"]

    # Sort newest first
    results.sort(key=lambda x: x["created_at"], reverse=True)
    return [CaseResponse(**c) for c in results]


@router.get(
    "/{case_id}",
    response_model=CaseResponse,
    summary="Retrieve Detailed Case Dossier",
)
def get_case_detail(case_id: str):
    """
    Fetches comprehensive case file including 360-degree suspect entity graph,
    multi-hop mule links, predicted cash-out hotspots, and escalation logs.
    """
    case_obj = state.CASES.get(case_id)
    if not case_obj:
        raise HTTPException(status_code=404, detail=f"Case '{case_id}' not found.")
    return CaseResponse(**case_obj)


@router.post(
    "/{case_id}/feedback",
    response_model=CaseResponse,
    summary="Submit Closed-Loop Investigator Feedback",
)
async def submit_case_feedback(case_id: str, feedback: CaseFeedbackRequest):
    """
    Investigator ground-truth feedback loop (CONFIRMED_FRAUD | FALSE_POSITIVE | RESOLVED).
    Updates case state, stores officer notes, and records in the audit log for continual model learning.
    """
    case_obj = state.CASES.get(case_id)
    if not case_obj:
        raise HTTPException(status_code=404, detail=f"Case '{case_id}' not found.")

    valid_statuses = ["CONFIRMED_FRAUD", "FALSE_POSITIVE", "RESOLVED", "UNDER_INVESTIGATION"]
    new_status = feedback.status.upper().strip()
    if new_status not in valid_statuses:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid status '{feedback.status}'. Must be one of: {', '.join(valid_statuses)}",
        )

    ts = get_current_timestamp()
    case_obj["status"] = new_status
    case_obj["feedback"] = {
        "status": new_status,
        "investigator_notes": feedback.investigator_notes or "",
        "investigator_id": feedback.investigator_id or "INVESTIGATOR_OFFICER",
        "timestamp": ts,
    }

    state.add_audit_log(
        action="CASE_FEEDBACK_SUBMITTED",
        entity_type="CASE",
        entity_id=case_id,
        user=feedback.investigator_id or "INVESTIGATOR",
        details={"new_status": new_status, "notes": feedback.investigator_notes},
    )

    # Multicast update
    asyncio.create_task(ws_hub.broadcast("CASE_UPDATED", {"case_id": case_id, "action": "FEEDBACK_UPDATED", "case": case_obj}))

    return CaseResponse(**case_obj)
