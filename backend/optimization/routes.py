from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Dict, Any
from datetime import datetime

from core.database import get_db
from optimization import models, schemas
from optimization.service import OptimizationEngine
from factors.models import Factor
from analysis.models import Analysis
from analysis.routes import compute_dataset_hash
from responses.models import ResponseModel
from experiments.models import DOERun

router = APIRouter(prefix="/optimization", tags=["Optimization"])
project_router = APIRouter(prefix="/projects/{project_id}/optimization", tags=["Optimization"])

@project_router.post("/", response_model=schemas.OptimizationResult)
def run_optimization(project_id: int, request: schemas.OptimizeRequest, db: Session = Depends(get_db)):
    factors = db.query(Factor).filter(Factor.project_id == project_id).order_by(Factor.code).all()
    analyses = db.query(Analysis).filter(Analysis.id.in_(request.analysis_ids)).all()

    if not factors or not analyses:
        raise HTTPException(status_code=400, detail="Missing factors or analyses for optimization.")

    # Deduplicate analyses by response_id to guarantee exactly ONE model per response
    unique_analyses_by_response = {}
    for a in analyses:
        if a.project_id != project_id:
            continue
        # Preserve the analysis specified in request, or latest if multiples passed
        unique_analyses_by_response[a.response_id] = a

    if not unique_analyses_by_response:
        raise HTTPException(status_code=400, detail="No valid analyses found for this project.")

    # Fetch experimental runs to compute observed data ranges if available
    first_analysis = next(iter(unique_analyses_by_response.values()))
    runs = db.query(DOERun).filter(DOERun.design_id == first_analysis.design_id).all() if first_analysis.design_id else []
    observed_vals = {}
    for r in runs:
        if r.response_values and not r.missing and not r.failed:
            for k, v in r.response_values.items():
                if v is not None:
                    try:
                        observed_vals.setdefault(k, []).append(float(v))
                    except (ValueError, TypeError):
                        pass

    models_data = []
    for resp_id, a in unique_analyses_by_response.items():
        resp = db.query(ResponseModel).filter(ResponseModel.id == resp_id).first()
        if not resp:
            continue

        resp_runs = db.query(DOERun).filter(DOERun.design_id == a.design_id).all() if a.design_id else []
        cur_hash = compute_dataset_hash(resp_runs, resp) if resp and resp_runs else None
        stored_hash = a.metrics.get("data_hash") if isinstance(a.metrics, dict) else None

        if stored_hash is None or stored_hash != cur_hash:
            resp_name_label = f"{resp.name} ({resp.code})" if resp else "response"
            raise HTTPException(
                status_code=400,
                detail={
                    "error": {
                        "code": "STALE_ANALYSIS",
                        "message": f"Selected model for {resp_name_label} is stale because experimental data has changed. Refit model before optimization."
                    }
                }
            )

        vals = observed_vals.get(resp.code) or observed_vals.get(resp.name) or []
        data_min = min(vals) if vals else None
        data_max = max(vals) if vals else None

        models_data.append({
            "response_id": resp.id,
            "response_code": resp.code,
            "response_name": resp.name,
            "coefs": a.coefficients,
            "model_type": a.model_type,
            "transformation": a.transformation,
            "target_type": resp.target_type,
            "target": float(resp.target) if resp.target is not None else None,
            "lower_limit": float(resp.lower_limit) if resp.lower_limit is not None else None,
            "upper_limit": float(resp.upper_limit) if resp.upper_limit is not None else None,
            "importance": float(resp.importance) if resp.importance is not None else 3.0,
            "data_min": data_min,
            "data_max": data_max
        })

    # Sort models_data by response_code for deterministic mapping (Y1, Y2, Y3, Y4)
    models_data.sort(key=lambda m: m["response_code"])

    candidates = OptimizationEngine.optimize(factors, models_data, request.settings)

    run = models.OptimizationRun(
        project_id=project_id,
        analysis_id=first_analysis.id,
        settings=request.settings,
        candidates=candidates,
        created_at=datetime.utcnow().isoformat()
    )
    db.add(run)
    db.commit()
    db.refresh(run)
    return run

@project_router.post("/confirm", response_model=schemas.ConfirmationResult)
def confirm_optimization(project_id: int, request: schemas.ConfirmationRequest, db: Session = Depends(get_db)):
    opt_run = db.query(models.OptimizationRun).filter(models.OptimizationRun.id == request.optimization_id).first()
    if not opt_run:
        raise HTTPException(status_code=404, detail="Optimization run not found")

    # Validate data_source
    data_source = request.data_source.upper() if request.data_source else "SIMULATED"
    if data_source not in ("SIMULATED", "EXPERIMENTAL"):
        raise HTTPException(status_code=400, detail="data_source must be SIMULATED or EXPERIMENTAL")

    diffs = {}
    for key, actual in request.actual_values.items():
        predicted = request.predicted_values.get(key)
        if predicted is not None:
            diffs[key] = abs(actual - predicted)

    conf_run = models.ConfirmationRun(
        project_id=project_id,
        optimization_id=request.optimization_id,
        predicted_values=request.predicted_values,
        actual_values=request.actual_values,
        differences=diffs,
        data_source=data_source,
        created_at=datetime.utcnow().isoformat()
    )
    db.add(conf_run)
    db.commit()
    db.refresh(conf_run)
    return conf_run

@project_router.get("/", response_model=List[schemas.OptimizationResult])
def get_optimizations(project_id: int, db: Session = Depends(get_db)):
    return db.query(models.OptimizationRun).filter(models.OptimizationRun.project_id == project_id).order_by(models.OptimizationRun.id.desc()).all()

@project_router.get("/confirm", response_model=List[schemas.ConfirmationResult])
def get_confirmations(project_id: int, db: Session = Depends(get_db)):
    return db.query(models.ConfirmationRun).filter(models.ConfirmationRun.project_id == project_id).order_by(models.ConfirmationRun.id.desc()).all()
