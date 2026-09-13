"""
==============================================================================
MuleShield (SIH26184) - Module E: Pydantic Data Models & API Schemas
==============================================================================
Strict schemas for ML predictions, case management, alerts, bank freezes,
and real-time WebSocket payloads.
==============================================================================
"""

from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


# ==============================================================================
# ML PREDICTION SCHEMAS
# ==============================================================================
class MulePredictionRequest(BaseModel):
    account_id: str = Field(..., example="M00001", description="Bank account ID to assess for mule behavior")


class FeatureImportanceItem(BaseModel):
    feature: str
    impact: float
    description: str


class MulePredictionResponse(BaseModel):
    account_id: str
    risk_score: int = Field(..., example=99, description="Calibrated integer risk score between 0 and 100")
    is_mule: bool
    confidence: float
    shap_explanation: Dict[str, float]
    top_features: List[FeatureImportanceItem]
    account_details: Optional[Dict[str, Any]] = None


class CashoutPredictionRequest(BaseModel):
    victim_lat: float = Field(..., example=28.4595, description="Victim GPS latitude")
    victim_lon: float = Field(..., example=77.0266, description="Victim GPS longitude")
    amount: float = Field(..., example=75000.0, description="Amount scammed/lost in INR")
    timestamp: Optional[str] = Field(None, example="2026-07-20 14:30:00", description="Incident timestamp")


class CashoutZoneItem(BaseModel):
    cell_id: str
    lat: float
    lon: float
    city: str
    risk_score: float
    predicted_withdrawal_window: str
    estimated_amount_at_risk: int
    nearest_atms: List[str]
    reasoning: List[str]


class CashoutPredictionResponse(BaseModel):
    top_5_zones: List[CashoutZoneItem]
    predicted_window: str
    complaint_summary: Dict[str, Any]


class SyndicatePredictionRequest(BaseModel):
    account_id: str = Field(..., example="M00001")


class SyndicatePredictionResponse(BaseModel):
    account_id: str
    ring_id: Optional[str]
    syndicate_id: Optional[str]
    members: List[str]
    confidence: float
    shared_devices: int
    operating_cities: List[str]
    total_volume_at_risk: Optional[float] = None


# ==============================================================================
# CASE MANAGEMENT SCHEMAS
# ==============================================================================
class CaseCreateRequest(BaseModel):
    victim_name: Optional[str] = Field(None, example="Aryan Maharaj")
    victim_phone: Optional[str] = Field(None, example="+91 98765 43210")
    victim_city: str = Field(..., example="Mumbai")
    victim_lat: float = Field(..., example=19.0760)
    victim_lon: float = Field(..., example=72.8777)
    suspect_account_id: str = Field(..., example="M00001")
    fraud_type: str = Field(..., example="Digital Arrest / CBI Impersonation")
    amount_lost: float = Field(..., example=125000.0)
    complaint_notes: Optional[str] = Field(None, example="Victim coerced into transfer under false arrest threat.")


class CaseFeedbackRequest(BaseModel):
    status: str = Field(..., example="CONFIRMED_FRAUD", description="CONFIRMED_FRAUD | FALSE_POSITIVE | RESOLVED")
    investigator_notes: Optional[str] = Field(None, example="ATM CCTV footage matches suspect. Freeze successful.")
    investigator_id: Optional[str] = Field("INV_OFFICER_01", example="INV_OFFICER_01")


class CaseResponse(BaseModel):
    case_id: str
    status: str
    created_at: str
    victim_info: Dict[str, Any]
    suspect_info: Dict[str, Any]
    resolved_entity: Dict[str, Any]
    predicted_cashout_zones: List[CashoutZoneItem]
    escalation_status: Dict[str, Any]
    feedback: Optional[Dict[str, Any]] = None


# ==============================================================================
# ALERTS & ESCALATION SCHEMAS
# ==============================================================================
class AlertDispatchRequest(BaseModel):
    account_id: str = Field(..., example="M00001")
    case_id: Optional[str] = Field(None, example="CASE-20260720-A1B2")
    risk_score: float = Field(..., example=96.5)
    amount: float = Field(..., example=85000.0)
    location: Optional[str] = Field(None, example="Gurugram (Sector 29)")
    notes: Optional[str] = Field(None, example="Immediate cash-out threat detected in syndicate corridor.")


class AlertAcknowledgeRequest(BaseModel):
    acknowledged_by: str = Field(..., example="Inspector Sharma (Cyber Cell)")
    notes: Optional[str] = Field(None, example="Field vehicle dispatched to Sector 29 ATM cluster.")


class AlertResponse(BaseModel):
    alert_id: str
    case_id: Optional[str]
    account_id: str
    risk_score: float
    amount: float
    severity: str
    escalation: Dict[str, Any]
    status: str
    created_at: str
    sla_seconds: Optional[int] = None
    sla_deadline: Optional[str] = None
    acknowledged_at: Optional[str] = None
    acknowledged_by: Optional[str] = None


class FreezeRequest(BaseModel):
    account_id: str = Field(..., example="M00001")
    case_id: Optional[str] = Field(None, example="CASE-20260720-A1B2")
    bank_name: Optional[str] = Field("State Bank of India", example="State Bank of India")
    freeze_reason: str = Field(..., example="Suspected money mule conduit under SIH26184 warrant")
    requested_by: str = Field(..., example="ACP Cybercrime Unit")
    risk_score: float = Field(..., example=98.5)
    amount_at_risk: float = Field(..., example=85000.0)


class FreezeResponse(BaseModel):
    freeze_id: str
    account_id: str
    bank_name: str
    status: str
    freeze_reference_no: str
    timestamp: str
    message: str


class FreezeActionRequest(BaseModel):
    action: str = Field("APPROVE", example="APPROVE", description="APPROVE | REJECT")
    officer_name: Optional[str] = Field(None, example="Nodal Bank Officer")
    officer: Optional[str] = Field(None, example="Nodal Bank Officer")
    comments: Optional[str] = Field(None, example="Debit freeze placed on suspect account. NOC notified.")
    notes: Optional[str] = Field(None, example="Debit freeze placed on suspect account. NOC notified.")

    def get_officer(self) -> str:
        return self.officer or self.officer_name or "Nodal Bank Officer"

    def get_notes(self) -> str:
        return self.notes or self.comments or ""


class HealthResponse(BaseModel):
    status: str
    service: str
    version: str
    uptime_seconds: float
    connected_clients: int
    models: Dict[str, str]
    cached_entities: Dict[str, int]


# ==============================================================================
# DASHBOARD METRICS & AUDIT SCHEMAS
# ==============================================================================
class StatsOverviewResponse(BaseModel):
    total_cases: int
    active_alerts: int
    total_amount_at_risk: float
    total_mules_flagged: int
    freeze_requests_pending: int
    high_risk_zones_active: int
    connected_clients: int
    system_status: str


class AuditLogEntry(BaseModel):
    timestamp: str
    action: str
    entity_type: str
    entity_id: str
    user: str
    details: Dict[str, Any]


# ==============================================================================
# MODULE G: ADMIN & BANK CONSOLE SCHEMAS
# ==============================================================================
class BankStatsResponse(BaseModel):
    pending_freezes: int
    critical_freezes: int
    approved_today: int
    amount_frozen_today: float
    avg_approval_seconds: float
    compliance_sla_rate: float
    total_frozen_overall: float


class AdminStatsResponse(BaseModel):
    api_status: str
    uptime_seconds: float
    uptime_human: str
    models_loaded_count: int
    total_models: int
    connected_clients: int
    connected_roles: Dict[str, int]
    cases_processed_today: int
    fraud_cases_count: int
    legit_cases_count: int
    precision_rate: float


class MetricHistoryPoint(BaseModel):
    date: str
    value: float


class ModelMetricsResponse(BaseModel):
    mule_detector: Dict[str, Any]
    cashout_predictor: Dict[str, Any]
    gnn_syndicate: Dict[str, Any]
    drift_status: str
    last_evaluated: str


class ModelRetrainResponse(BaseModel):
    status: str
    queue_position: int = 1
    eta_seconds: int = 120
    features_count: int = 18
    message: str
    timestamp: str


class UserResponse(BaseModel):
    id: str
    name: str
    email: str
    role: str
    department: str
    last_login: str
    status: str


class UserCreateRequest(BaseModel):
    name: str = Field(..., example="Inspector Sharma")
    email: str = Field(..., example="sharma@i4c.gov.in")
    role: str = Field(..., example="Investigator", description="Admin | Investigator | Bank | Analyst | Read-Only")
    department: Optional[str] = Field("Cyber Crime Branch", example="Cyber Crime Branch")


# ==============================================================================
# MODULE H: ESCALATION MATRIX & SLA SCHEMAS
# ==============================================================================
class EscalationResult(BaseModel):
    severity: str
    alert_id: str
    case_id: str
    actions_taken: List[str]
    sla_seconds: int
    sla_deadline: str
    channels: List[str]
    freeze_auto_generated: bool
    freeze_id: Optional[str] = None
    timestamp: str


class SLAStatusResponse(BaseModel):
    alert_id: Optional[str] = None
    case_id: Optional[str] = None
    severity: str
    seconds_remaining: int
    total_seconds: int
    percentage_remaining: float
    status: str  # ON_TRACK | WARNING | CRITICAL | BREACHED | RESOLVED
    color_hex: str
    is_breached: bool
    is_warning: bool
    is_critical: bool
    deadline: str
    resolved_at: Optional[str] = None
    resolved_by: Optional[str] = None


class AlertEscalateRequest(BaseModel):
    new_severity: str = Field(..., example="CRITICAL", description="CRITICAL | HIGH | MEDIUM")
    reason: Optional[str] = Field("Investigative triage elevated priority", example="Corridor syndicate movement confirmed")
    officer_name: Optional[str] = Field("ACP Cybercrime Unit", example="ACP Cybercrime Unit")


class AlertResolveRequest(BaseModel):
    outcome: str = Field(..., example="CONFIRMED_FRAUD", description="CONFIRMED_FRAUD | FALSE_POSITIVE | PREEMPTIVE_FREEZE_SUCCESS")
    resolution_notes: Optional[str] = Field("Debit freeze confirmed. Funds recovered.", example="Lien marked on account")
    officer_name: Optional[str] = Field("Inspector Sharma", example="Inspector Sharma")


class NotificationLogResponse(BaseModel):
    channel: str
    provider: str
    recipient_phone: Optional[str] = None
    recipient_role: Optional[str] = None
    message: Optional[str] = None
    script: Optional[str] = None
    officer_id: Optional[str] = None
    alert_id: Optional[str] = None
    severity: Optional[str] = None
    status: str
    timestamp: Optional[str] = None
    delivered_at: Optional[str] = None
    latency_ms: Optional[int] = None


class SLADashboardResponse(BaseModel):
    compliance_rates: Dict[str, float]  # { "CRITICAL": 96.2, "HIGH": 98.5, "MEDIUM": 99.1, "LOW": 100.0, "OVERALL": 98.4 }
    total_tracked: int
    active_countdowns: List[Dict[str, Any]]
    recent_escalations: List[Dict[str, Any]]
    historical_chart: List[Dict[str, Any]]



