"""
==============================================================================
MuleShield (SIH26184) - Module H: Emergency Notification Dispatch Channels
==============================================================================
Provides asynchronous mock dispatchers for:
- SMS Gateway (ACP Cybercrime, Nodal Bank Officers)
- Automated Voice Telephony Autodialer (IVR Urgent Intervention)
- Mobile Push Notifications (Field Interceptors, Cyber Patrol Units)
- Statutory Section 102 CrPC Preemptive Bank Debit Freeze Generation
Logs every dispatch realistically to state.NOTIFICATION_LOGS and AUDIT_LOGS.
==============================================================================
"""

import asyncio
from typing import Any, Dict, Optional
from datetime import datetime

from backend.api import state
from backend.api.utils import generate_freeze_id, get_current_timestamp
from backend.api.websocket_hub import ws_hub


async def send_sms(phone: str, message: str, recipient_role: str = "ACP Cybercrime") -> Dict[str, Any]:
    """
    Simulates high-priority SMS transmission via Indian telecom SMS Gateway (CDAC / NIC / Telco).
    Logs to notification audit repository.
    """
    await asyncio.sleep(0.05)  # Realistic network latency simulation
    ts = get_current_timestamp()

    log_entry = {
        "channel": "SMS",
        "provider": "mock_telecom_gateway",
        "recipient_phone": phone,
        "recipient_role": recipient_role,
        "message": message,
        "status": "SENT",
        "delivered_at": ts,
        "latency_ms": 128,
    }

    state.NOTIFICATION_LOGS.insert(0, log_entry)
    if len(state.NOTIFICATION_LOGS) > 500:
        state.NOTIFICATION_LOGS.pop()

    state.add_audit_log(
        action="SMS_DISPATCHED",
        entity_type="NOTIFICATION",
        entity_id=f"SMS-{phone[-4:]}",
        user="ESCALATION_ENGINE",
        details={"phone": phone, "role": recipient_role, "message_preview": message[:60]},
    )

    return {
        "status": "sent",
        "provider": "mock_twilio_cdac",
        "phone": phone,
        "message": message,
        "timestamp": ts,
    }


async def send_call(phone: str, script: str, recipient_role: str = "ACP Duty Officer") -> Dict[str, Any]:
    """
    Simulates automated priority outbound voice call / IVR autodialer dispatch.
    """
    await asyncio.sleep(0.08)  # Realistic network latency simulation
    ts = get_current_timestamp()

    log_entry = {
        "channel": "VOICE_CALL",
        "provider": "mock_ivr_autodialer",
        "recipient_phone": phone,
        "recipient_role": recipient_role,
        "script": script,
        "status": "QUEUED",
        "duration_seconds": 0,
        "queued_at": ts,
    }

    state.NOTIFICATION_LOGS.insert(0, log_entry)
    if len(state.NOTIFICATION_LOGS) > 500:
        state.NOTIFICATION_LOGS.pop()

    state.add_audit_log(
        action="CALL_QUEUED",
        entity_type="NOTIFICATION",
        entity_id=f"CALL-{phone[-4:]}",
        user="ESCALATION_ENGINE",
        details={"phone": phone, "role": recipient_role, "script_summary": script[:60]},
    )

    return {
        "status": "queued",
        "duration": 0,
        "provider": "mock_exotel_telephony",
        "phone": phone,
        "script": script,
        "timestamp": ts,
    }


async def push_mobile_notification(officer_id: str, alert: Dict[str, Any]) -> Dict[str, Any]:
    """
    Dispatches real-time push notification to mobile tactical interceptor units.
    """
    await asyncio.sleep(0.04)
    ts = get_current_timestamp()

    log_entry = {
        "channel": "PUSH_NOTIFICATION",
        "provider": "mock_fcm_apns",
        "officer_id": officer_id,
        "alert_id": alert.get("alert_id"),
        "severity": alert.get("severity", "CRITICAL"),
        "title": f"🚨 {alert.get('severity')} CASH-OUT INTERCEPT",
        "body": f"Account {alert.get('account_id')}: ₹{alert.get('amount', 0):,.0f} flagged for urgent freeze/intercept",
        "status": "DELIVERED",
        "timestamp": ts,
    }

    state.NOTIFICATION_LOGS.insert(0, log_entry)
    if len(state.NOTIFICATION_LOGS) > 500:
        state.NOTIFICATION_LOGS.pop()

    state.add_audit_log(
        action="PUSH_DELIVERED",
        entity_type="NOTIFICATION",
        entity_id=officer_id,
        user="ESCALATION_ENGINE",
        details={"alert_id": alert.get("alert_id"), "officer": officer_id},
    )

    return {
        "status": "delivered",
        "officer_id": officer_id,
        "alert_id": alert.get("alert_id"),
        "timestamp": ts,
    }


async def generate_freeze_request(
    case_id: str,
    mule_account_id: str,
    amount: float = 0.0,
    bank_name: str = "State Bank of India",
    severity: str = "CRITICAL",
    risk_score: float = 0.95,
) -> Dict[str, Any]:
    """
    Automatically creates a Section 102 CrPC statutory debit freeze order in FREEZE_QUEUE.
    Broadcasts FREEZE_PENDING to Bank Officer Console over WebSockets.
    """
    # Check if a freeze order already exists for this case/account
    for existing in state.FREEZE_QUEUE:
        if existing.get("account_id") == mule_account_id and existing.get("case_id") == case_id:
            return existing

    freeze_id = generate_freeze_id()
    created_at = get_current_timestamp()
    ref_no = f"LEA-WARRANT-{freeze_id}"

    freeze_item = {
        "freeze_id": freeze_id,
        "account_id": mule_account_id,
        "case_id": case_id,
        "bank_name": bank_name,
        "risk_score": risk_score if risk_score > 1.0 else risk_score * 100.0,
        "amount_at_risk": amount,
        "victim_amount": amount,
        "severity": severity,
        "status": "PENDING_BANK_APPROVAL",
        "freeze_reference_no": ref_no,
        "timestamp": created_at,
        "requested_by": "Automated Escalation Matrix (CRITICAL Protocol)",
        "resolved_by": None,
        "resolved_at": None,
        "time_since": "just now",
        "message": f"Preemptive debit freeze generated under CRITICAL escalation protocol. Section 102 CrPC statutory warrant #{ref_no}.",
    }

    state.FREEZE_QUEUE.insert(0, freeze_item)

    state.add_audit_log(
        action="FREEZE_AUTO_GENERATED",
        entity_type="FREEZE_ORDER",
        entity_id=freeze_id,
        user="ESCALATION_ENGINE",
        details={
            "case_id": case_id,
            "account_id": mule_account_id,
            "amount": amount,
            "ref_no": ref_no,
            "severity": severity,
        },
    )

    # Broadcast to Bank & Investigator over WebSockets
    await ws_hub.broadcast(
        "FREEZE_PENDING",
        {"freeze_id": freeze_id, "status": "PENDING_BANK_APPROVAL", "item": freeze_item},
        roles=["bank", "investigator", "admin"],
    )

    return freeze_item
