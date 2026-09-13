"""
==============================================================================
MuleShield (SIH26184) - Module E: Distributed FastAPI Server & WebSocket Hub
==============================================================================
Central operational server running on 0.0.0.0:8000 for multi-laptop deployment:
- HQ Server: FastAPI + CatBoost/LogisticReg/GNN Models + WebSocket Broadcaster
- Investigator Dashboard: GIS Map, Entity Resolution, Case Management
- Bank Officer Console: Real-time Section 102 CrPC Debit Freeze Orders
- Field Patrol Units: Golden-hour ATM cash-out zone alerts
==============================================================================
"""

import asyncio
import json
import uuid
from contextlib import asynccontextmanager
from datetime import datetime

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from backend.api import state
from backend.api.routes_admin import router as admin_router
from backend.api.routes_alerts import router as alerts_router
from backend.api.routes_cases import router as cases_router
from backend.api.routes_field import router as field_router
from backend.api.routes_ml import router as ml_router
from backend.api.schemas import HealthResponse
from backend.api.websocket_hub import ws_hub


async def sla_background_monitor():
    """Periodically verifies ongoing alert SLAs and broadcasts SLA_WARNING and SLA_BREACH."""
    while True:
        try:
            await asyncio.sleep(2)
            now = datetime.now()
            for alert_id, record in list(state.SLA_TRACKER.items()):
                if record.get("status") in ["ACTIVE", "ACKNOWLEDGED"]:
                    deadline_str = record.get("deadline")
                    total_sec = record.get("sla_seconds", 3600)
                    try:
                        d_dt = datetime.strptime(deadline_str, "%Y-%m-%d %H:%M:%S")
                        rem = (d_dt - now).total_seconds()
                    except Exception:
                        continue

                    # SLA Warning: at 50% or less remaining
                    if rem <= (total_sec * 0.5) and not record.get("warning_sent"):
                        record["warning_sent"] = True
                        await ws_hub.broadcast(
                            "SLA_WARNING",
                            {
                                "alert_id": alert_id,
                                "case_id": record.get("case_id"),
                                "severity": record.get("severity"),
                                "seconds_remaining": max(0, int(rem)),
                                "deadline": deadline_str,
                            },
                        )

                    # SLA Breach: time expired
                    if rem <= 0 and not record.get("breached"):
                        record["breached"] = True
                        record["status"] = "BREACHED"
                        await ws_hub.broadcast(
                            "SLA_BREACH",
                            {
                                "alert_id": alert_id,
                                "case_id": record.get("case_id"),
                                "severity": record.get("severity"),
                                "breached_at": now.strftime("%Y-%m-%d %H:%M:%S"),
                            },
                        )
        except asyncio.CancelledError:
            break
        except Exception:
            pass


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Application startup and shutdown lifespan context:
    1. Pre-loads all ML models, CSV datasets, and NetworkX transaction graph.
    2. Seeds 5 realistic demo cases across Indian cities with active SLA timers.
    3. Spawns asynchronous SLA monitor for real-time WebSocket SLA_WARNING and SLA_BREACH alerts.
    """
    state.load_artifacts()

    banner = """
======================================================================
  MuleShield API v1.0 ready on http://0.0.0.0:8000/docs
  Multi-Laptop LAN Access: http://192.168.1.100:8000/docs
======================================================================
"""
    print(banner)
    state.append_system_log("INFO", "MuleShield API v1.0 ready on http://0.0.0.0:8000/docs")

    sla_task = asyncio.create_task(sla_background_monitor())

    yield

    sla_task.cancel()
    try:
        await sla_task
    except asyncio.CancelledError:
        pass

    print("[MuleShield API] Shutting down distributed server...")
    state.append_system_log("INFO", "MuleShield API server stopped gracefully")



app = FastAPI(
    title="MuleShield API — SIH26184",
    description="""
## MuleShield: AI-Powered Mule Account Detection & Predictive Cash-Out Intelligence System
**Ministry of Home Affairs (I4C) | Smart India Hackathon (SIH26184)**

### Real-Time Capabilities:
- **Mule Account Scoring**: Sub-second probability prediction with CatBoost & SHAP explainability.
- **Predictive Cash-Out Forecasting**: Sub-10ms spatial prediction of likely ATM cash withdrawal zones before physical cash-out occurs.
- **Syndicate Ring Traversal**: Multi-hop NetworkX entity resolution and Louvain/GNN community detection.
- **Operational Escalation Matrix**: 4-tier emergency response protocol (CRITICAL, HIGH, MEDIUM, LOW) with automatic bank freeze queues.
- **Distributed WebSocket Multicast**: Real-time channel broadcasting (`NEW_ALERT`, `FREEZE_APPROVED`, `CASE_UPDATED`, `FIELD_DISPATCH`) for multi-laptop demo environments.
    """,
    version="1.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

# ==============================================================================
# CROSS-ORIGIN RESOURCE SHARING (CORS) - Multi-Laptop LAN Binding
# ==============================================================================
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Permits cross-laptop access from 192.168.1.x
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ==============================================================================
# REGISTER MODULAR ROUTERS
# ==============================================================================
app.include_router(ml_router)
app.include_router(cases_router)
app.include_router(alerts_router)
app.include_router(admin_router)
app.include_router(field_router)



# ==============================================================================
# ROOT & SYSTEM HEALTH ENDPOINTS
# ==============================================================================
@app.get(
    "/",
    tags=["System Health & Diagnostics"],
    summary="Root Service Status",
)
def root():
    """Returns basic service health, version, and documentation links."""
    return {
        "status": "ok",
        "service": "MuleShield API",
        "version": "1.0",
        "hackathon": "Smart India Hackathon (SIH26184)",
        "docs_url": "/docs",
        "redoc_url": "/redoc",
        "timestamp": datetime.now().isoformat(),
    }


@app.get(
    "/api/health",
    response_model=HealthResponse,
    tags=["System Health & Diagnostics"],
    summary="System Health, Model Status & Client Telemetry",
)
def get_health():
    """
    Comprehensive system health check:
    - Status of CatBoost, Logistic Regression, and PyTorch GNN models
    - Server uptime in seconds
    - Connected WebSocket clients count
    - In-memory entity and graph statistics
    """
    graph_nodes = state.TRANSACTION_GRAPH.number_of_nodes() if state.TRANSACTION_GRAPH else 0
    grid_cells = len(state.GRID_CELLS_DF) if state.GRID_CELLS_DF is not None else 0

    return HealthResponse(
        status="ok",
        service="MuleShield API",
        version="1.0",
        uptime_seconds=state.get_uptime_seconds(),
        connected_clients=ws_hub.get_connected_count(),
        models=state.MODEL_STATUS,
        cached_entities={
            "cases": len(state.CASES),
            "alerts": len(state.ALERTS),
            "freeze_orders": len(state.FREEZE_QUEUE),
            "graph_nodes": graph_nodes,
            "grid_cells": grid_cells,
        },
    )


# ==============================================================================
# DISTRIBUTED WEBSOCKET HUB
# ==============================================================================
@app.websocket("/ws/{client_type}")
async def websocket_endpoint(websocket: WebSocket, client_type: str):
    """
    Bi-directional real-time WebSocket connection hub.
    - Path parameter: client_type (investigator | bank | admin | field)
    - Channels: NEW_ALERT, FREEZE_APPROVED, CASE_UPDATED, FIELD_DISPATCH
    - Automatic connection telemetry and keepalive ping-pong.
    """
    client_id = f"{client_type.lower()}_{uuid.uuid4().hex[:6]}"
    client_ip = websocket.client.host if websocket.client else "unknown"

    await ws_hub.connect(websocket, client_type=client_type, client_id=client_id, client_ip=client_ip)
    try:
        while True:
            raw_text = await websocket.receive_text()
            try:
                msg = json.loads(raw_text)
                if msg.get("type") == "PING":
                    await websocket.send_text(json.dumps({"type": "PONG", "timestamp": datetime.now().isoformat()}))
            except Exception:
                pass
    except WebSocketDisconnect:
        await ws_hub.disconnect(client_id)
    except Exception as exc:
        state.append_system_log("WARNING", f"WebSocket error on client {client_id}: {exc}")
        await ws_hub.disconnect(client_id)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("backend.api.main:app", host="0.0.0.0", port=8000, reload=True)
