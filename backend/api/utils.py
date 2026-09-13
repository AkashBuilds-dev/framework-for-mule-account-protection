"""
==============================================================================
MuleShield (SIH26184) - Module E: API Shared Utilities & Escalation Matrix
==============================================================================
Provides standardized identifier generation, UTC/IST timestamp formatting,
and the formal SIH26184 Escalation Matrix (Blueprint Item #50).
==============================================================================
"""

import random
import string
from datetime import datetime


def get_current_timestamp() -> str:
    """Returns current local timestamp formatted as YYYY-MM-DD HH:MM:SS."""
    return datetime.now().strftime("%Y-%m-%d %H:%M:%S")


def get_iso_timestamp() -> str:
    """Returns current timestamp formatted in ISO 8601."""
    return datetime.now().isoformat()


def generate_case_id() -> str:
    """Generates unique Case ID: CASE-YYYYMMDD-XXXX."""
    date_str = datetime.now().strftime("%Y%m%d")
    random_str = "".join(random.choices(string.ascii_uppercase + string.digits, k=4))
    return f"CASE-{date_str}-{random_str}"


def generate_alert_id() -> str:
    """Generates unique Alert ID: ALT-XXXXXX."""
    random_str = "".join(random.choices(string.digits, k=6))
    return f"ALT-{random_str}"


def generate_freeze_id() -> str:
    """Generates unique Freeze Request ID: FRZ-YYYYMMDD-XXXX."""
    date_str = datetime.now().strftime("%Y%m%d")
    random_str = "".join(random.choices(string.digits, k=4))
    return f"FRZ-{date_str}-{random_str}"


def evaluate_escalation_matrix(risk_score: float, amount: float) -> dict:
    """
    Implements Blueprint Item #50: 4-Tier Law Enforcement & Bank Escalation Matrix.
    - CRITICAL (risk >= 0.90 AND amount >= Rs. 50,000):
      SMS + Automated Phone Call + LEA Field Unit Dispatch + Automated Bank Freeze Suggested.
    - HIGH (risk >= 0.75):
      SMS + Live Dashboard Alert + Bank Freeze Recommended.
    - MEDIUM (risk >= 0.50):
      Live Dashboard Alert for Investigator Monitoring.
    - LOW (risk < 0.50):
      Audit Log & Routine Monitoring.
    """
    # Normalize risk score to 0.0 - 1.0 if passed as 0 - 100
    norm_risk = risk_score / 100.0 if risk_score > 1.0 else risk_score

    if norm_risk >= 0.90 and amount >= 50000.0:
        return {
            "severity": "CRITICAL",
            "channels": ["SMS_GATEWAY", "VOICE_CALL_AUTODIAL", "LEA_FIELD_DISPATCH", "BANK_FREEZE_AUTO_SUGGEST"],
            "response_protocol": "P1_URGENT_INTERVENTION",
            "sla_minutes": 5,
            "sla_seconds": 300,
            "action_plan": "Emergency LEA patrol dispatched. Automated bank freeze request queued. Respond within 5 minutes.",
        }
    elif norm_risk >= 0.75:
        return {
            "severity": "HIGH",
            "channels": ["SMS_GATEWAY", "DASHBOARD_LIVE_ALERT", "BANK_FREEZE_SUGGESTED"],
            "response_protocol": "P2_ELEVATED_RISK",
            "sla_minutes": 15,
            "sla_seconds": 900,
            "action_plan": "SMS sent to ACP Cybercrime. Bank freeze suggested in nodal queue. SLA: 15 minutes.",
        }
    elif norm_risk >= 0.50:
        return {
            "severity": "MEDIUM",
            "channels": ["DASHBOARD_LIVE_ALERT"],
            "response_protocol": "P3_INVESTIGATOR_REVIEW",
            "sla_minutes": 60,
            "sla_seconds": 3600,
            "action_plan": "Flagged on investigator dashboard for transaction graph and device ring review. SLA: 1 hour.",
        }
    else:
        return {
            "severity": "LOW",
            "channels": ["AUDIT_LOG_ONLY"],
            "response_protocol": "P4_ROUTINE_MONITORING",
            "sla_minutes": 1440,
            "sla_seconds": 86400,
            "action_plan": "Recorded in central audit trail for routine statistical monitoring within 24 hours.",
        }

