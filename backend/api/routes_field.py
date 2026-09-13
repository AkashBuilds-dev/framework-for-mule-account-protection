"""Mobile field-officer dispatch and evidence-reporting API (Module I)."""

from datetime import datetime
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

from backend.api import state
from backend.api.websocket_hub import ws_hub

router = APIRouter(prefix="/api/field", tags=["Field Officer PWA"])


class DeferRequest(BaseModel):
    reason: str = Field(..., min_length=3, max_length=400)


class FieldReportRequest(BaseModel):
    dispatch_id: str
    outcome: str
    suspect_details: Optional[Dict[str, Any]] = None
    evidence_urls: List[str] = []
    gps_lat: float
    gps_lon: float
    notes: Optional[str] = ""


def _dispatch_or_404(dispatch_id: str) -> Dict[str, Any]:
    dispatch = next((item for item in state.DISPATCHES if item["dispatch_id"] == dispatch_id), None)
    if not dispatch:
        raise HTTPException(status_code=404, detail=f"Dispatch '{dispatch_id}' not found")
    return dispatch


@router.get("/officer/{officer_id}")
def get_officer(officer_id: str):
    officer = next((item for item in state.OFFICERS if item["officer_id"] == officer_id), None)
    if not officer:
        raise HTTPException(status_code=404, detail=f"Officer '{officer_id}' not found")
    active = sum(1 for item in state.DISPATCHES if item["officer_id"] == officer_id and item["status"] not in ["COMPLETED", "DEFERRED"])
    return {**officer, "active_dispatches": active}


@router.get("/dispatches")
def get_dispatches(officer_id: str = Query(...)):
    return [item for item in state.DISPATCHES if item["officer_id"] == officer_id and item["status"] not in ["COMPLETED", "DEFERRED"]]


@router.post("/dispatch/{dispatch_id}/accept")
async def accept_dispatch(dispatch_id: str):
    dispatch = _dispatch_or_404(dispatch_id)
    dispatch["status"] = "ACCEPTED"
    dispatch["accepted_at"] = state.get_current_timestamp()
    state.add_audit_log("FIELD_DISPATCH_ACCEPTED", "DISPATCH", dispatch_id, dispatch["officer_name"], {"case_id": dispatch["case_id"]})
    await ws_hub.broadcast("FIELD_DISPATCH_UPDATE", dispatch)
    return dispatch


@router.post("/dispatch/{dispatch_id}/defer")
async def defer_dispatch(dispatch_id: str, payload: DeferRequest):
    dispatch = _dispatch_or_404(dispatch_id)
    dispatch["status"] = "DEFERRED"
    dispatch["deferred_reason"] = payload.reason
    dispatch["deferred_at"] = state.get_current_timestamp()
    state.add_audit_log("FIELD_DISPATCH_DEFERRED", "DISPATCH", dispatch_id, dispatch["officer_name"], {"reason": payload.reason})
    await ws_hub.broadcast("FIELD_DISPATCH_UPDATE", dispatch)
    return dispatch


@router.post("/dispatch/{dispatch_id}/arrived")
async def arrived_at_dispatch(dispatch_id: str):
    dispatch = _dispatch_or_404(dispatch_id)
    dispatch["status"] = "ON_SITE"
    dispatch["arrived_at"] = state.get_current_timestamp()
    state.add_audit_log("FIELD_OFFICER_ON_SITE", "DISPATCH", dispatch_id, dispatch["officer_name"], {"destination": dispatch["destination"]})
    await ws_hub.broadcast("FIELD_DISPATCH_UPDATE", dispatch)
    return dispatch


@router.post("/report", status_code=201)
async def submit_field_report(payload: FieldReportRequest):
    dispatch = _dispatch_or_404(payload.dispatch_id)
    report_id = f"RPT-{datetime.now().strftime('%Y%m%d-%H%M%S')}-{len(state.FIELD_REPORTS) + 1:03d}"
    report = {
        "report_id": report_id, "dispatch_id": dispatch["dispatch_id"], "case_id": dispatch["case_id"],
        "officer_id": dispatch["officer_id"], "officer_name": dispatch["officer_name"], "outcome": payload.outcome,
        "suspect_details": payload.suspect_details or {}, "evidence_urls": payload.evidence_urls,
        "gps_lat": payload.gps_lat, "gps_lon": payload.gps_lon, "notes": payload.notes or "", "created_at": state.get_current_timestamp(),
    }
    state.FIELD_REPORTS.insert(0, report)
    dispatch["status"] = "COMPLETED"
    dispatch["report_id"] = report_id
    dispatch["completed_at"] = report["created_at"]
    state.add_audit_log("FIELD_REPORT_SUBMITTED", "FIELD_REPORT", report_id, dispatch["officer_name"], {"case_id": dispatch["case_id"], "dispatch_id": dispatch["dispatch_id"], "outcome": payload.outcome})
    await ws_hub.broadcast("FIELD_REPORT_SUBMITTED", {"report": report, "dispatch": dispatch})
    return {"success": True, "report": report, "message": f"Field report {report_id} recorded for case {dispatch['case_id']}."}


@router.get("/history")
def get_history(officer_id: str = Query(...)):
    reports = [item for item in state.FIELD_REPORTS if item["officer_id"] == officer_id]
    completed = [item for item in state.DISPATCHES if item["officer_id"] == officer_id and item["status"] in ["COMPLETED", "DEFERRED"]]
    return {"reports": reports[:30], "dispatches": completed[:30]}
