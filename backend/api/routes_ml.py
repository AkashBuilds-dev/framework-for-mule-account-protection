"""
==============================================================================
MuleShield (SIH26184) - Module E: Machine Learning & Geospatial Endpoints
==============================================================================
Provides high-performance inference endpoints:
- POST /api/predict/mule: Mule probability scoring with SHAP explainability
- POST /api/predict/cashout: Spatial withdrawal forecasting (<10ms)
- POST /api/predict/syndicate: Mule syndicate ring identification
- GET /api/grid/risk: 410-cell uniform geospatial risk grid as GeoJSON
- GET /api/grid/top-zones: Ranked high-risk withdrawal zones
==============================================================================
"""

import ast
from datetime import datetime
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, HTTPException, Query
import pandas as pd

from backend.api import state
from backend.api.models_integration import (
    predict_cashout_zones_internal,
    predict_mule_score_internal,
    predict_syndicate_ring_internal,
)
from backend.api.schemas import (
    CashoutPredictionRequest,
    CashoutPredictionResponse,
    CashoutZoneItem,
    MulePredictionRequest,
    MulePredictionResponse,
    SyndicatePredictionRequest,
    SyndicatePredictionResponse,
)

router = APIRouter(prefix="/api", tags=["Machine Learning & Intelligence"])


@router.post(
    "/predict/mule",
    response_model=MulePredictionResponse,
    summary="Evaluate Account Mule Probability & SHAP Drivers",
)
def predict_mule(request: MulePredictionRequest):
    """
    Evaluates an account ID using the CatBoost classifier trained on 15 topological
    and behavioral banking features. Returns a calibrated risk score (0-100), binary
    classification, and top SHAP feature importance rationales.
    """
    account_id = request.account_id.strip()
    if not account_id:
        raise HTTPException(status_code=400, detail="Account ID cannot be blank.")

    try:
        result = predict_mule_score_internal(account_id)
        state.add_audit_log(
            action="MULE_PREDICTION",
            entity_type="ACCOUNT",
            entity_id=account_id,
            user="INVESTIGATOR",
            details={"risk_score": result["risk_score"], "is_mule": result["is_mule"]},
        )
        return result
    except Exception as exc:
        state.append_system_log("ERROR", f"Failed mule prediction for {account_id}: {exc}")
        raise HTTPException(status_code=500, detail=f"Mule prediction engine error: {str(exc)}")


@router.post(
    "/predict/cashout",
    response_model=CashoutPredictionResponse,
    summary="Predict Cash-Out Withdrawal Locations in Advance (<10ms)",
)
def predict_cashout(request: CashoutPredictionRequest):
    """
    SIH26184 Core Requirement: Forecasts likely cash withdrawal zones in advance.
    Combines spatial risk regression, DBSCAN hotspot clustering, and golden-hour
    time decay to return top 5 ATM zones before physical cash-out occurs.
    """
    ts = request.timestamp or datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    try:
        zones_data = predict_cashout_zones_internal(
            lat=request.victim_lat,
            lon=request.victim_lon,
            amount=request.amount,
            timestamp=ts,
        )

        if not zones_data:
            raise HTTPException(status_code=500, detail="No cash-out prediction zones could be generated.")

        # Convert to Pydantic models
        zone_items = [CashoutZoneItem(**z) for z in zones_data]
        pred_window = zones_data[0]["predicted_withdrawal_window"] if zones_data else "Immediate (Next 60 min)"

        complaint_summary = {
            "victim_lat": request.victim_lat,
            "victim_lon": request.victim_lon,
            "amount": request.amount,
            "timestamp": ts,
            "forecast_algorithm": "Spatial Hybrid (LogReg + DBSCAN + Proximity)",
        }

        state.add_audit_log(
            action="CASHOUT_FORECAST",
            entity_type="COORDINATES",
            entity_id=f"{request.victim_lat:.4f},{request.victim_lon:.4f}",
            user="INVESTIGATOR",
            details={"amount": request.amount, "top_zone": zone_items[0].cell_id if zone_items else None},
        )

        return CashoutPredictionResponse(
            top_5_zones=zone_items,
            predicted_window=pred_window,
            complaint_summary=complaint_summary,
        )
    except HTTPException:
        raise
    except Exception as exc:
        state.append_system_log("ERROR", f"Failed cashout prediction: {exc}")
        raise HTTPException(status_code=500, detail=f"Cashout prediction engine error: {str(exc)}")


@router.post(
    "/predict/syndicate",
    response_model=SyndicatePredictionResponse,
    summary="Detect Syndicate Ring & Associated Mules",
)
def predict_syndicate(request: SyndicatePredictionRequest):
    """
    Uncovers mule syndicates, shared device rings, and layered money laundering
    paths using pre-computed Louvain community detection and GNN graph embeddings.
    """
    account_id = request.account_id.strip()
    if not account_id:
        raise HTTPException(status_code=400, detail="Account ID cannot be blank.")

    try:
        result = predict_syndicate_ring_internal(account_id)
        state.add_audit_log(
            action="SYNDICATE_LOOKUP",
            entity_type="ACCOUNT",
            entity_id=account_id,
            user="INVESTIGATOR",
            details={"ring_id": result.get("ring_id"), "members_count": len(result.get("members", []))},
        )
        return result
    except Exception as exc:
        state.append_system_log("ERROR", f"Failed syndicate detection for {account_id}: {exc}")
        raise HTTPException(status_code=500, detail=f"Syndicate prediction engine error: {str(exc)}")


@router.get(
    "/grid/risk",
    summary="Export 410-Cell Uniform Risk Grid as GeoJSON",
)
def get_grid_risk():
    """
    Returns the complete 410-cell uniform urban risk grid (0.02° x 0.02° ~2km x 2km)
    as a standard GeoJSON FeatureCollection ready for GIS mapping layers (Leaflet, Mapbox).
    """
    df_grid = state.GRID_CELLS_DF
    if df_grid is None or df_grid.empty:
        raise HTTPException(status_code=404, detail="Geospatial grid data is not loaded.")

    features = []
    for _, row in df_grid.iterrows():
        c_lat = float(row.get("center_lat", 0.0))
        c_lon = float(row.get("center_lon", 0.0))

        # Determine cell boundary polygon
        min_lat = float(row.get("min_lat", c_lat - 0.01))
        max_lat = float(row.get("max_lat", c_lat + 0.01))
        min_lon = float(row.get("min_lon", c_lon - 0.01))
        max_lon = float(row.get("max_lon", c_lon + 0.01))

        polygon_coords = [
            [
                [min_lon, min_lat],
                [max_lon, min_lat],
                [max_lon, max_lat],
                [min_lon, max_lat],
                [min_lon, min_lat],
            ]
        ]

        # Parse nearest_atms if stored as string
        nearest_atms = row.get("nearest_atms", [])
        if isinstance(nearest_atms, str):
            try:
                nearest_atms = ast.literal_eval(nearest_atms)
            except Exception:
                nearest_atms = [nearest_atms]

        properties = {
            "cell_id": str(row.get("cell_id")),
            "city": str(row.get("city", "Unknown")),
            "risk_score": round(float(row.get("final_score", 0.0)), 4),
            "is_high_risk": bool(row.get("is_high_risk", 0) == 1),
            "is_syndicate_hub": bool(row.get("is_syndicate_hub", 0) == 1),
            "atm_count": int(row.get("atm_count", 0)),
            "center_lat": c_lat,
            "center_lon": c_lon,
            "nearest_atms": nearest_atms[:3] if isinstance(nearest_atms, list) else [],
        }

        features.append({
            "type": "Feature",
            "geometry": {
                "type": "Polygon",
                "coordinates": polygon_coords,
            },
            "properties": properties,
        })

    return {
        "type": "FeatureCollection",
        "total_cells": len(features),
        "timestamp": datetime.now().isoformat(),
        "features": features,
    }


@router.get(
    "/grid/top-zones",
    summary="Retrieve Top N High-Risk Cash-Out Zones",
)
def get_top_risk_zones(n: int = Query(20, ge=1, le=100, description="Number of top zones to return")):
    """
    Returns the top N ranked withdrawal zones prioritized by composite risk scores,
    historical ATM volume, and syndicate hub proximity.
    """
    if state.TOP_RISK_ZONES_DATA:
        return state.TOP_RISK_ZONES_DATA[:n]

    # Fallback to sorting grid_cells.csv
    df_grid = state.GRID_CELLS_DF
    if df_grid is not None and not df_grid.empty:
        sorted_grid = df_grid.sort_values(by="final_score", ascending=False).head(n)
        return sorted_grid.to_dict(orient="records")

    raise HTTPException(status_code=404, detail="Risk zones data is currently unavailable.")
