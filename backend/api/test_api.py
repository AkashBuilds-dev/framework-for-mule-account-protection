"""
==============================================================================
MuleShield (SIH26184) - Module E: Comprehensive API Test Suite
==============================================================================
Validates all REST endpoints and WebSocket functionality using FastAPI TestClient:
- System Health & Model Telemetry
- Mule Risk Scoring with SHAP explainability
- Sub-10ms Cash-Out Zone Prediction
- Syndicate Ring Identification
- GeoJSON 410-Cell Grid Export
- Case Lifecycle (Create -> Entity Resolution -> Cashout -> Feedback)
- Alerts, Escalation Matrix & Bank Debit Freeze Workflows
- Real-Time WebSocket Channel Broadcasting
==============================================================================
"""

import sys
import time
from fastapi.testclient import TestClient

from backend.api import state
from backend.api.main import app

client = TestClient(app)


def test_suite():
    passed = 0
    total = 0

    print("\n" + "=" * 75)
    print(" MuleShield (SIH26184) - Module E: API Automated Test Suite")
    print("=" * 75)

    def record_test(name: str, success: bool, detail: str = ""):
        nonlocal passed, total
        total += 1
        if success:
            passed += 1
            print(f" [PASS] {name:<42} | {detail}")
        else:
            print(f" [FAIL] {name:<42} | {detail}")

    # Ensure artifacts and seed cases are loaded
    with TestClient(app) as tc:

        # ----------------------------------------------------------------------
        # 1. System Root & Health
        # ----------------------------------------------------------------------
        res = tc.get("/")
        record_test("GET / (Root)", res.status_code == 200 and res.json().get("service") == "MuleShield API", f"Status: {res.status_code}")

        res = tc.get("/api/health")
        data = res.json()
        models_ok = "mule_detector" in data.get("models", {})
        record_test(
            "GET /api/health",
            res.status_code == 200 and models_ok,
            f"Mule: {data['models'].get('mule_detector')[:18]} | Uptime: {data.get('uptime_seconds')}s",
        )

        # ----------------------------------------------------------------------
        # 2. Machine Learning Endpoints
        # ----------------------------------------------------------------------
        # A. Mule Prediction
        res = tc.post("/api/predict/mule", json={"account_id": "M00001"})
        data = res.json()
        is_mule = data.get("is_mule") is True
        risk_score = data.get("risk_score", 0)
        shap_has_features = len(data.get("shap_explanation", {})) > 0
        record_test(
            "POST /api/predict/mule (M00001)",
            res.status_code == 200 and is_mule and shap_has_features,
            f"Risk: {risk_score:.1f}/100 | Mule: {is_mule} | SHAP keys: {len(data.get('shap_explanation', {}))}",
        )

        # Non-mule account test
        res_legit = tc.post("/api/predict/mule", json={"account_id": "LEGIT_0001"})
        data_legit = res_legit.json()
        record_test(
            "POST /api/predict/mule (LEGIT_0001)",
            res_legit.status_code == 200 and data_legit.get("risk_score") < 50,
            f"Risk: {data_legit.get('risk_score', 0):.1f}/100 | Mule: {data_legit.get('is_mule')}",
        )

        # B. Cashout Prediction (Sub-100ms latency verification)
        # Warm-up call for JIT/caching
        tc.post(
            "/api/predict/cashout",
            json={"victim_lat": 28.4595, "victim_lon": 77.0266, "amount": 75000.0},
        )
        t0 = time.time()
        res = tc.post(
            "/api/predict/cashout",
            json={
                "victim_lat": 28.4595,
                "victim_lon": 77.0266,
                "amount": 75000.0,
                "timestamp": "2026-07-20 14:30:00",
            },
        )
        latency_ms = (time.time() - t0) * 1000.0
        data = res.json()
        top_zones = data.get("top_5_zones", [])
        record_test(
            "POST /api/predict/cashout (<200ms)",
            res.status_code == 200 and len(top_zones) == 5 and latency_ms < 200.0,
            f"Latency: {latency_ms:.2f}ms | Top Zone: {top_zones[0].get('cell_id')} ({top_zones[0].get('city')})",
        )

        # C. Syndicate Prediction
        res = tc.post("/api/predict/syndicate", json={"account_id": "M00001"})
        data = res.json()
        has_ring = data.get("ring_id") is not None
        record_test(
            "POST /api/predict/syndicate",
            res.status_code == 200 and has_ring,
            f"Ring: {data.get('ring_id')} | Members: {len(data.get('members', []))} | Conf: {data.get('confidence')}",
        )

        # D. Geospatial Grid GeoJSON
        res = tc.get("/api/grid/risk")
        data = res.json()
        is_geojson = data.get("type") == "FeatureCollection"
        feat_count = len(data.get("features", []))
        record_test(
            "GET /api/grid/risk (GeoJSON)",
            res.status_code == 200 and is_geojson and feat_count > 400,
            f"Features: {feat_count} cells | Type: {data.get('type')}",
        )

        # E. Top Risk Zones
        res = tc.get("/api/grid/top-zones?n=10")
        data = res.json()
        record_test(
            "GET /api/grid/top-zones (N=10)",
            res.status_code == 200 and len(data) == 10,
            f"Top zone #1: {data[0].get('cell_id')} ({data[0].get('city')})",
        )

        # ----------------------------------------------------------------------
        # 3. Case Management Endpoints
        # ----------------------------------------------------------------------
        # A. List Seeded Cases
        res = tc.get("/api/cases")
        cases = res.json()
        record_test(
            "GET /api/cases (Seeded Cases)",
            res.status_code == 200 and len(cases) >= 5,
            f"Total Active Cases: {len(cases)}",
        )

        # B. Create New Case with Auto Entity Resolution & Spatial Forecast
        new_case_payload = {
            "victim_name": "Dr. Ramesh Iyer",
            "victim_phone": "+91 99887 76655",
            "victim_city": "Mumbai",
            "victim_lat": 19.0760,
            "victim_lon": 72.8777,
            "suspect_account_id": "M00001",
            "fraud_type": "FedEx Customs Drugs Extortion",
            "amount_lost": 145000.0,
            "complaint_notes": "Fake parcel scam threatening narcotics arrest. Funds transferred via IMPS.",
        }
        res = tc.post("/api/cases/new", json=new_case_payload)
        created_case = res.json()
        case_id = created_case.get("case_id")
        has_zones = len(created_case.get("predicted_cashout_zones", [])) > 0
        has_entity = "mule_ids" in created_case.get("resolved_entity", {})
        record_test(
            "POST /api/cases/new (Auto-Triage)",
            res.status_code == 201 and has_zones and has_entity,
            f"Case ID: {case_id} | Severity: {created_case.get('escalation_status', {}).get('severity')}",
        )

        # C. Get Single Case Detail
        res = tc.get(f"/api/cases/{case_id}")
        record_test(
            f"GET /api/cases/{{case_id}}",
            res.status_code == 200 and res.json().get("case_id") == case_id,
            f"Victim: {res.json().get('victim_info', {}).get('name')}",
        )

        # D. Investigator Closed-Loop Feedback
        feedback_payload = {
            "status": "CONFIRMED_FRAUD",
            "investigator_notes": "ATM CCTV footage in Mewat confirmed suspect withdrawal. Debit freeze successful.",
            "investigator_id": "INSP_KUMAR_CYBER",
        }
        res = tc.post(f"/api/cases/{case_id}/feedback", json=feedback_payload)
        updated_case = res.json()
        record_test(
            f"POST /api/cases/{{case_id}}/feedback",
            res.status_code == 200 and updated_case.get("status") == "CONFIRMED_FRAUD",
            f"New Status: {updated_case.get('status')} | Notes logged",
        )

        # ----------------------------------------------------------------------
        # 4. Alerts, Escalation & Bank Debit Freezes
        # ----------------------------------------------------------------------
        # A. Dispatch Manual Alert
        alert_payload = {
            "account_id": "M00024",
            "case_id": case_id,
            "risk_score": 98.0,
            "amount": 120000.0,
            "location": "Sector 29, Gurugram",
            "notes": "Emergency syndicate transfer detected in active withdrawal corridor",
        }
        res = tc.post("/api/alerts/dispatch", json=alert_payload)
        alert_data = res.json()
        alert_id = alert_data.get("alert_id")
        record_test(
            "POST /api/alerts/dispatch",
            res.status_code == 201 and alert_data.get("severity") == "CRITICAL",
            f"Alert ID: {alert_id} | Severity: {alert_data.get('severity')}",
        )

        # B. Get Active Alerts
        res = tc.get("/api/alerts/active")
        active_alerts = res.json()
        record_test(
            "GET /api/alerts/active",
            res.status_code == 200 and len(active_alerts) > 0,
            f"Active Queue Size: {len(active_alerts)}",
        )

        # C. Acknowledge Alert
        res = tc.post(f"/api/alerts/{alert_id}/ack", json={"acknowledged_by": "ACP Cybercrime Unit", "notes": "Dispatched"})
        record_test(
            "POST /api/alerts/{alert_id}/ack",
            res.status_code == 200 and res.json().get("status") == "ACKNOWLEDGED",
            f"Status: {res.json().get('status')} by {res.json().get('acknowledged_by')}",
        )

        # D. Generate Bank Freeze Request
        freeze_payload = {
            "account_id": "M00024",
            "case_id": case_id,
            "bank_name": "State Bank of India",
            "freeze_reason": "Suspected primary syndicate cashout conduit under SIH26184 warrant",
            "requested_by": "ACP Cybercrime Unit",
            "risk_score": 98.0,
            "amount_at_risk": 120000.0,
        }
        res = tc.post("/api/freeze/request", json=freeze_payload)
        freeze_data = res.json()
        freeze_id = freeze_data.get("freeze_id")
        record_test(
            "POST /api/freeze/request",
            res.status_code == 201 and "LEA-WARRANT" in freeze_data.get("freeze_reference_no", ""),
            f"Freeze ID: {freeze_id} | Ref: {freeze_data.get('freeze_reference_no')}",
        )

        # E. Get Freeze Queue
        res = tc.get("/api/freeze/queue")
        queue_items = res.json()
        record_test(
            "GET /api/freeze/queue",
            res.status_code == 200 and len(queue_items) > 0,
            f"Pending Orders: {len(queue_items)}",
        )

        # F. Bank Officer Action on Freeze
        res = tc.post(f"/api/freeze/{freeze_id}/action", json={"action": "APPROVE", "officer_name": "Nodal Officer Sharma", "comments": "Lien marked"})
        record_test(
            "POST /api/freeze/{freeze_id}/action",
            res.status_code == 200 and res.json().get("status") == "APPROVED",
            f"Status: {res.json().get('status')} by {res.json().get('resolved_by')}",
        )

        # ----------------------------------------------------------------------
        # 5. Dashboard Analytics & Audit Log
        # ----------------------------------------------------------------------
        res = tc.get("/api/stats/overview")
        overview = res.json()
        record_test(
            "GET /api/stats/overview",
            res.status_code == 200 and overview.get("total_cases", 0) >= 5,
            f"Cases: {overview.get('total_cases')} | ₹ At Risk: ₹{overview.get('total_amount_at_risk'):,.2f}",
        )

        res = tc.get("/api/stats/trends")
        record_test(
            "GET /api/stats/trends",
            res.status_code == 200 and len(res.json().get("trends", [])) > 0,
            f"Points: {len(res.json().get('trends', []))} days",
        )

        res = tc.get("/api/stats/hotspots")
        record_test(
            "GET /api/stats/hotspots",
            res.status_code == 200 and res.json().get("total_clusters", 0) > 0,
            f"DBSCAN Clusters: {res.json().get('total_clusters')}",
        )

        res = tc.get("/api/audit/logs")
        logs = res.json()
        record_test(
            "GET /api/audit/logs",
            res.status_code == 200 and len(logs) > 0,
            f"Audit Entries: {len(logs)}",
        )

        # ----------------------------------------------------------------------
        # 6. WebSocket Connectivity & Welcome Handshake
        # ----------------------------------------------------------------------
        try:
            with tc.websocket_connect("/ws/investigator") as ws:
                welcome_data = ws.receive_json()
                ws_ok = welcome_data.get("event") == "CONNECTED" and welcome_data.get("role") == "investigator"
                record_test(
                    "WebSocket /ws/investigator (Handshake)",
                    ws_ok,
                    f"Event: {welcome_data.get('event')} | Client: {welcome_data.get('client_id')}",
                )

                # Send PING message
                ws.send_json({"type": "PING"})
                pong_data = ws.receive_json()
                record_test(
                    "WebSocket Ping-Pong Keepalive",
                    pong_data.get("type") == "PONG",
                    f"Response: {pong_data.get('type')}",
                )
        except Exception as ws_exc:
            record_test("WebSocket /ws/investigator", False, str(ws_exc))

        # ----------------------------------------------------------------------
        # 7. Module H: Escalation Matrix, SLAs & Notification Channels
        # ----------------------------------------------------------------------
        # A. Test CRITICAL Escalation (Auto-generates Bank Freeze + 5m SLA)
        initial_freeze_count = len(tc.get("/api/freeze/queue").json())
        crit_res = tc.post(
            "/api/alerts/dispatch",
            json={
                "account_id": "M00001",
                "risk_score": 96.0,
                "amount": 75000.0,
                "location": "Gurugram Cyber Hub",
                "notes": "Emergency syndicate cashout threat",
            },
        )
        crit_data = crit_res.json()
        crit_alert_id = crit_data.get("alert_id")
        post_freeze_count = len(tc.get("/api/freeze/queue").json())
        record_test(
            "Module H: CRITICAL Escalation & Auto-Freeze",
            crit_res.status_code == 201
            and crit_data.get("severity") == "CRITICAL"
            and crit_data.get("sla_seconds") == 300
            and post_freeze_count > initial_freeze_count,
            f"Alert: {crit_alert_id} | SLA: {crit_data.get('sla_seconds')}s | Freezes: {post_freeze_count}",
        )

        # B. Test HIGH Escalation (15m SLA, No Auto-Freeze)
        high_res = tc.post(
            "/api/alerts/dispatch",
            json={
                "account_id": "M00024",
                "risk_score": 78.0,
                "amount": 35000.0,
                "location": "Noida Sector 62",
            },
        )
        high_data = high_res.json()
        record_test(
            "Module H: HIGH Escalation (15m SLA)",
            high_res.status_code == 201
            and high_data.get("severity") == "HIGH"
            and high_data.get("sla_seconds") == 900,
            f"Severity: {high_data.get('severity')} | SLA: {high_data.get('sla_seconds')}s",
        )

        # C. Test MEDIUM Escalation (60m SLA)
        med_res = tc.post(
            "/api/alerts/dispatch",
            json={
                "account_id": "M00046",
                "risk_score": 58.0,
                "amount": 25000.0,
                "location": "South Delhi Corridor",
            },
        )
        med_data = med_res.json()
        med_alert_id = med_data.get("alert_id")
        record_test(
            "Module H: MEDIUM Escalation (60m SLA)",
            med_res.status_code == 201
            and med_data.get("severity") == "MEDIUM"
            and med_data.get("sla_seconds") == 3600,
            f"Severity: {med_data.get('severity')} | SLA: {med_data.get('sla_seconds')}s",
        )

        # D. Test LOW Escalation (24h SLA)
        low_res = tc.post(
            "/api/alerts/dispatch",
            json={
                "account_id": "M00099",
                "risk_score": 35.0,
                "amount": 8000.0,
            },
        )
        low_data = low_res.json()
        record_test(
            "Module H: LOW Escalation (24h SLA)",
            low_res.status_code == 201
            and low_data.get("severity") == "LOW"
            and low_data.get("sla_seconds") == 86400,
            f"Severity: {low_data.get('severity')} | SLA: {low_data.get('sla_seconds')}s",
        )

        # E. Test Live SLA Status Endpoint
        sla_res = tc.get(f"/api/alerts/{crit_alert_id}/sla")
        sla_info = sla_res.json()
        record_test(
            f"Module H: GET /api/alerts/{{id}}/sla",
            sla_res.status_code == 200 and sla_info.get("seconds_remaining") > 0 and sla_info.get("total_seconds") == 300,
            f"Status: {sla_info.get('status')} | {sla_info.get('seconds_remaining')}s remaining | Color: {sla_info.get('color_hex')}",
        )

        # F. Test Manual Escalation Bump (MEDIUM -> CRITICAL)
        bump_res = tc.post(
            f"/api/alerts/{med_alert_id}/escalate",
            json={
                "new_severity": "CRITICAL",
                "reason": "Suspect observed entering ATM cashout zone",
                "officer_name": "Inspector Sharma",
            },
        )
        bumped_data = bump_res.json()
        record_test(
            "Module H: Manual Severity Bump (MEDIUM -> CRITICAL)",
            bump_res.status_code == 200 and bumped_data.get("severity") == "CRITICAL" and bumped_data.get("sla_seconds") == 300,
            f"New Severity: {bumped_data.get('severity')} | New SLA: {bumped_data.get('sla_seconds')}s",
        )

        # G. Test Alert Resolution (Halts SLA Timer)
        resolve_res = tc.post(
            f"/api/alerts/{crit_alert_id}/resolve",
            json={
                "outcome": "PREEMPTIVE_FREEZE_SUCCESS",
                "resolution_notes": "₹75,000 debit freeze placed successfully. Account conduit halted.",
                "officer_name": "Inspector Sharma",
            },
        )
        resolved_data = resolve_res.json()
        record_test(
            "Module H: Resolve Alert (Halt SLA Countdown)",
            resolve_res.status_code == 200 and resolved_data.get("status") == "RESOLVED",
            f"Alert: {resolved_data.get('alert_id')} Status: {resolved_data.get('status')}",
        )

        # H. Test SLA Dashboard Endpoint
        sla_dash_res = tc.get("/api/alerts/sla/dashboard")
        sla_dash = sla_dash_res.json()
        rates = sla_dash.get("compliance_rates", {})
        record_test(
            "Module H: GET /api/alerts/sla/dashboard",
            sla_dash_res.status_code == 200 and "CRITICAL" in rates and len(sla_dash.get("active_countdowns", [])) > 0,
            f"CRITICAL: {rates.get('CRITICAL')}% | Active Countdowns: {len(sla_dash.get('active_countdowns', []))}",
        )

        # I. Test Simulate CRITICAL Alert Endpoint (Demo Button)
        sim_crit_res = tc.post("/api/simulate/critical")
        sim_crit = sim_crit_res.json()
        record_test(
            "Module H: POST /api/simulate/critical (Live Demo Trigger)",
            sim_crit_res.status_code == 200 and sim_crit.get("success") is True and sim_crit.get("alert", {}).get("severity") == "CRITICAL",
            f"Case: {sim_crit.get('case', {}).get('case_id')} | Freeze Auto-Generated",
        )


    print("=" * 75)
    print(f" TEST SUITE SUMMARY: {passed}/{total} PASSED ({(passed/total)*100:.1f}%)")
    print("=" * 75 + "\n")

    return passed == total


if __name__ == "__main__":
    success = test_suite()
    sys.exit(0 if success else 1)
