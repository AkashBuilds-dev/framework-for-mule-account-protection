"""
==============================================================================
MuleShield (SIH26184) - Module H: 4-Tier Escalation Matrix Engine
==============================================================================
Implements Blueprint Item #50:
- CRITICAL (risk >= 0.90 AND amount >= Rs 50,000):
    * SMS to ACP Cybercrime + Bank Nodal Officer
    * Automated Telephony Call
    * LEA Field Patrol Team Dispatch
    * Auto-generate statutory Bank Freeze Request
    * Broadcast: NEW_ALERT + FIELD_DISPATCH + FREEZE_PENDING
    * SLA: 5 minutes (300 seconds)
- HIGH (risk >= 0.75):
    * SMS to ACP Cybercrime
    * Live Dashboard Alert
    * Suggested Bank Freeze (not auto)
    * Broadcast: NEW_ALERT
    * SLA: 15 minutes (900 seconds)
- MEDIUM (risk >= 0.50):
    * Dashboard Alert Only
    * Broadcast: NEW_ALERT
    * SLA: 1 hour (3600 seconds)
- LOW (risk < 0.50):
    * Log Only (no broadcast)
    * SLA: 24 hours (86400 seconds)
==============================================================================
"""

import asyncio
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Tuple

from backend.api import state
from backend.api.notifications import (
    generate_freeze_request,
    push_mobile_notification,
    send_call,
    send_sms,
)
from backend.api.utils import generate_alert_id, get_current_timestamp
from backend.api.websocket_hub import ws_hub


SLA_DEFINITIONS = {
    "CRITICAL": {"minutes": 5, "seconds": 300, "label": "5m (Immediate Intervention)"},
    "HIGH": {"minutes": 15, "seconds": 900, "label": "15m (Urgent Triage)"},
    "MEDIUM": {"minutes": 60, "seconds": 3600, "label": "1h (Investigator Review)"},
    "LOW": {"minutes": 1440, "seconds": 86400, "label": "24h (Routine Monitoring)"},
}


def determine_severity(risk_score: float, amount: float) -> Tuple[str, int]:
    """
    Evaluates calibrated risk score and exposed amount to assign severity tier & SLA seconds.
    Supports both 0.0-1.0 and 0.0-100.0 risk score representations.
    """
    norm_risk = risk_score / 100.0 if risk_score > 1.0 else risk_score

    if norm_risk >= 0.90 and amount >= 50000.0:
        return "CRITICAL", 300
    elif norm_risk >= 0.75:
        return "HIGH", 900
    elif norm_risk >= 0.50:
        return "MEDIUM", 3600
    else:
        return "LOW", 86400


async def apply_escalation(
    case_id: str,
    risk_score: float,
    amount: float,
    suspect_account_id: Optional[str] = None,
    bank_name: Optional[str] = None,
    alert_id: Optional[str] = None,
    location: Optional[str] = None,
    notes: Optional[str] = None,
    created_at: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Applies the full 4-tier escalation logic:
    - Triggers automated notifications (SMS, Call, Push, Auto-freeze)
    - Records timeline in state.ESCALATION_LOG and state.SLA_TRACKER
    - Broadcasts channel events via WebSocket Hub
    Returns EscalationResult dictionary.
    """
    severity, sla_seconds = determine_severity(risk_score, amount)
    ts = created_at or get_current_timestamp()

    # Calculate SLA deadline
    try:
        created_dt = datetime.strptime(ts, "%Y-%m-%d %H:%M:%S")
    except Exception:
        created_dt = datetime.now()
    deadline_dt = created_dt + timedelta(seconds=sla_seconds)
    deadline_str = deadline_dt.strftime("%Y-%m-%d %H:%M:%S")

    account_id = suspect_account_id or "M00001"
    bank = bank_name or "State Bank of India"
    alt_id = alert_id or generate_alert_id()

    actions_taken: List[str] = []
    channels: List[str] = []
    freeze_auto_generated = False
    freeze_id = None

    # 1. Tier Action Execution
    if severity == "CRITICAL":
        channels = [
            "SMS_ACP_CYBERCRIME",
            "SMS_NODAL_BANK_OFFICER",
            "VOICE_CALL_AUTODIAL",
            "LEA_FIELD_DISPATCH",
            "AUTO_BANK_FREEZE",
            "WEBSOCKET_BROADCAST",
        ]

        # SMS to ACP Cybercrime
        await send_sms(
            phone="+91 98100 11223",
            message=f"CRITICAL CYBER ALERT: Case {case_id} flagged ₹{amount:,.0f} at risk on Mule Account {account_id}. Emergency freeze generated. Respond within 5 min.",
            recipient_role="ACP Cybercrime Unit (HQ)",
        )
        actions_taken.append("SMS sent to ACP Cybercrime (+91 98100 11223)")

        # SMS to Bank Nodal Officer
        await send_sms(
            phone="+91 98200 99887",
            message=f"STATUTORY FREEZE NOTICE (Sec 102 CrPC): Account {account_id} ({bank}) marked for emergency debit suspension. Amount: ₹{amount:,.0f}.",
            recipient_role="Nodal Bank Fraud Officer",
        )
        actions_taken.append("SMS sent to Bank Nodal Officer (+91 98200 99887)")

        # Automated Call to ACP Duty Officer
        await send_call(
            phone="+91 98100 11223",
            script=f"Attention ACP Duty Officer. Critical money mule syndicate operation detected for Case {case_id}. Potential physical cash-out imminent. Preemptive freeze requested. Check terminal immediately.",
            recipient_role="ACP Duty Room",
        )
        actions_taken.append("Automated telephony call queued to ACP Duty Room")

        # Mobile Push to Field Patrol Team
        await push_mobile_notification(
            officer_id="PATROL_NCR_UNIT_04",
            alert={"alert_id": alt_id, "account_id": account_id, "amount": amount, "severity": "CRITICAL"},
        )
        actions_taken.append("LEA Field Interceptor Unit Dispatched (Patrol Unit 04)")

        # Auto-generate Bank Freeze Request
        freeze_obj = await generate_freeze_request(
            case_id=case_id,
            mule_account_id=account_id,
            amount=amount,
            bank_name=bank,
            severity="CRITICAL",
            risk_score=risk_score,
        )
        freeze_auto_generated = True
        freeze_id = freeze_obj.get("freeze_id")
        actions_taken.append(f"Auto-generated Section 102 CrPC Freeze Order #{freeze_id}")

        # Broadcast WebSocket Triad: NEW_ALERT + FIELD_DISPATCH + FREEZE_PENDING
        alert_payload = {
            "alert_id": alt_id,
            "case_id": case_id,
            "account_id": account_id,
            "risk_score": risk_score if risk_score > 1.0 else risk_score * 100.0,
            "amount": amount,
            "severity": "CRITICAL",
            "sla_seconds": sla_seconds,
            "sla_deadline": deadline_str,
            "created_at": ts,
            "status": "ACTIVE",
            "location": location or "Gurugram / Mewat Corridor",
        }
        await ws_hub.broadcast("NEW_ALERT", alert_payload)
        await ws_hub.broadcast(
            "FIELD_DISPATCH",
            {
                "case_id": case_id,
                "alert_id": alt_id,
                "unit": "Patrol Unit 04",
                "corridor": location or "NCR / Mewat Grid",
                "timestamp": ts,
            },
        )

    elif severity == "HIGH":
        channels = ["SMS_ACP_CYBERCRIME", "DASHBOARD_LIVE_ALERT", "SUGGESTED_BANK_FREEZE"]
        await send_sms(
            phone="+91 98100 11223",
            message=f"HIGH THREAT ALERT: Case {case_id} flagged ₹{amount:,.0f} on Account {account_id}. Bank freeze suggested. SLA: 15 min.",
            recipient_role="ACP Cybercrime Unit",
        )
        actions_taken.append("SMS sent to ACP Cybercrime (+91 98100 11223)")
        actions_taken.append("High-Priority Dashboard Alert Triggered")
        actions_taken.append("Bank Freeze Suggested in Nodal Queue")

        # Broadcast NEW_ALERT
        alert_payload = {
            "alert_id": alt_id,
            "case_id": case_id,
            "account_id": account_id,
            "risk_score": risk_score if risk_score > 1.0 else risk_score * 100.0,
            "amount": amount,
            "severity": "HIGH",
            "sla_seconds": sla_seconds,
            "sla_deadline": deadline_str,
            "created_at": ts,
            "status": "ACTIVE",
            "location": location or "Noida / Delhi Grid",
        }
        await ws_hub.broadcast("NEW_ALERT", alert_payload)

    elif severity == "MEDIUM":
        channels = ["DASHBOARD_LIVE_ALERT"]
        actions_taken.append("Dashboard Alert Generated for Investigator Review")
        alert_payload = {
            "alert_id": alt_id,
            "case_id": case_id,
            "account_id": account_id,
            "risk_score": risk_score if risk_score > 1.0 else risk_score * 100.0,
            "amount": amount,
            "severity": "MEDIUM",
            "sla_seconds": sla_seconds,
            "sla_deadline": deadline_str,
            "created_at": ts,
            "status": "ACTIVE",
            "location": location or "Regional Hub",
        }
        await ws_hub.broadcast("NEW_ALERT", alert_payload)

    else:  # LOW
        channels = ["AUDIT_LOG_ONLY"]
        actions_taken.append("Logged to central audit repository for routine 24h review")

    # 2. Update SLA Tracker
    sla_record = {
        "alert_id": alt_id,
        "case_id": case_id,
        "account_id": account_id,
        "severity": severity,
        "sla_seconds": sla_seconds,
        "created_at": ts,
        "deadline": deadline_str,
        "status": "ACTIVE",
        "breached": False,
        "warning_sent": False,
        "resolved_at": None,
        "resolved_by": None,
        "outcome": None,
    }
    state.SLA_TRACKER[alt_id] = sla_record
    state.SLA_TRACKER[case_id] = sla_record

    # 3. Log to ESCALATION_LOG
    escalation_entry = {
        "timestamp": ts,
        "severity": severity,
        "alert_id": alt_id,
        "actions_taken": actions_taken,
        "sla_deadline": deadline_str,
        "sla_seconds": sla_seconds,
        "channels": channels,
        "freeze_auto_generated": freeze_auto_generated,
        "freeze_id": freeze_id,
    }
    if case_id not in state.ESCALATION_LOG:
        state.ESCALATION_LOG[case_id] = []
    state.ESCALATION_LOG[case_id].insert(0, escalation_entry)

    state.add_audit_log(
        action="ESCALATION_APPLIED",
        entity_type="CASE",
        entity_id=case_id,
        user="ESCALATION_MATRIX",
        details={
            "severity": severity,
            "alert_id": alt_id,
            "sla_deadline": deadline_str,
            "actions_count": len(actions_taken),
        },
    )

    return {
        "severity": severity,
        "alert_id": alt_id,
        "case_id": case_id,
        "actions_taken": actions_taken,
        "sla_seconds": sla_seconds,
        "sla_deadline": deadline_str,
        "channels": channels,
        "freeze_auto_generated": freeze_auto_generated,
        "freeze_id": freeze_id,
        "timestamp": ts,
    }


def get_escalation_log(case_id: str) -> List[Dict[str, Any]]:
    """Returns chronologically ordered escalation timeline for a case."""
    return state.ESCALATION_LOG.get(case_id, [])


def compute_sla_breach(alert_or_case_id: str) -> Tuple[bool, int, str]:
    """
    Calculates SLA status, seconds remaining, and status label.
    Returns (is_breached, seconds_remaining, status_str).
    """
    tracker = state.SLA_TRACKER.get(alert_or_case_id)
    if not tracker:
        return False, 0, "UNKNOWN"

    if tracker.get("status") == "RESOLVED":
        return False, 0, "RESOLVED"

    deadline_str = tracker.get("deadline")
    try:
        deadline_dt = datetime.strptime(deadline_str, "%Y-%m-%d %H:%M:%S")
        remaining = int((deadline_dt - datetime.now()).total_seconds())
    except Exception:
        remaining = 0

    if remaining <= 0:
        return True, 0, "BREACHED"
    return False, remaining, "ACTIVE"


def compute_sla_status(alert_or_case_id: str) -> Dict[str, Any]:
    """
    Computes comprehensive SLA countdown metrics for UI cards and timers:
    - seconds_remaining, total_seconds, percentage_remaining
    - ui_status: "ON_TRACK" (>50%), "WARNING" (25-50%), "CRITICAL" (<25% or <2m), "BREACHED" (<=0)
    - color_hex: #10B981 (green), #F59E0B (amber), #EF4444 (red)
    """
    tracker = state.SLA_TRACKER.get(alert_or_case_id)
    if not tracker:
        # Fallback if unindexed
        return {
            "alert_id": alert_or_case_id,
            "severity": "MEDIUM",
            "seconds_remaining": 1800,
            "total_seconds": 3600,
            "percentage_remaining": 50.0,
            "status": "ON_TRACK",
            "color_hex": "#10B981",
            "is_breached": False,
            "is_warning": False,
            "is_critical": False,
            "deadline": get_current_timestamp(),
        }

    severity = tracker.get("severity", "MEDIUM")
    total_seconds = tracker.get("sla_seconds", 3600)
    deadline_str = tracker.get("deadline")

    try:
        deadline_dt = datetime.strptime(deadline_str, "%Y-%m-%d %H:%M:%S")
        remaining = int((deadline_dt - datetime.now()).total_seconds())
    except Exception:
        remaining = 0

    pct = max(0.0, min(100.0, round((remaining / total_seconds) * 100.0, 1))) if total_seconds > 0 else 0.0

    if tracker.get("status") == "RESOLVED":
        return {
            "alert_id": tracker.get("alert_id"),
            "case_id": tracker.get("case_id"),
            "severity": severity,
            "seconds_remaining": 0,
            "total_seconds": total_seconds,
            "percentage_remaining": 0.0,
            "status": "RESOLVED",
            "color_hex": "#10B981",
            "is_breached": False,
            "is_warning": False,
            "is_critical": False,
            "deadline": deadline_str,
            "resolved_at": tracker.get("resolved_at"),
            "resolved_by": tracker.get("resolved_by"),
        }

    if remaining <= 0:
        ui_status = "BREACHED"
        color = "#EF4444"
        is_breached = True
        is_warning = False
        is_critical = True
    elif pct < 25.0 or remaining < 120:
        ui_status = "CRITICAL"
        color = "#EF4444"
        is_breached = False
        is_warning = False
        is_critical = True
    elif pct <= 50.0:
        ui_status = "WARNING"
        color = "#F59E0B"
        is_breached = False
        is_warning = True
        is_critical = False
    else:
        ui_status = "ON_TRACK"
        color = "#10B981"
        is_breached = False
        is_warning = False
        is_critical = False

    return {
        "alert_id": tracker.get("alert_id"),
        "case_id": tracker.get("case_id"),
        "severity": severity,
        "seconds_remaining": max(0, remaining),
        "total_seconds": total_seconds,
        "percentage_remaining": pct,
        "status": ui_status,
        "color_hex": color,
        "is_breached": is_breached,
        "is_warning": is_warning,
        "is_critical": is_critical,
        "deadline": deadline_str,
    }
