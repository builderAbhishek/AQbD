from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime
import pandas as pd

from core.database import get_db
from analysis import models, schemas
from analysis.service import StatisticalEngine
from projects.models import Project
from doe.models import DOEDesign
from experiments.models import DOERun
from responses.models import ResponseModel
from factors.models import Factor

import hashlib
import json

def compute_dataset_hash(runs, response) -> str:
    data = []
    if not runs or not response:
        return ""
    for r in sorted(runs, key=lambda x: (x.run_order if x.run_order is not None else 0, x.id)):
        if r.missing or r.failed:
            continue
        val = None
        if r.response_values:
            if response.name in r.response_values:
                val = r.response_values[response.name]
            elif response.code in r.response_values:
                val = r.response_values[response.code]
        if val is not None:
            try:
                data.append({
                    "id": r.id,
                    "coded": r.coded_values,
                    "val": round(float(val), 6)
                })
            except (ValueError, TypeError):
                pass
    return hashlib.sha256(json.dumps(data, sort_keys=True).encode()).hexdigest()

router = APIRouter(prefix="/analysis", tags=["Analysis"])
project_router = APIRouter(prefix="/projects/{project_id}/analysis", tags=["Analysis"])

@project_router.post("/", response_model=schemas.AnalysisResult)
def run_analysis(project_id: int, request: schemas.AnalyzeRequest, db: Session = Depends(get_db)):
    design = db.query(DOEDesign).filter(DOEDesign.id == request.design_id).first()
    response = db.query(ResponseModel).filter(ResponseModel.id == request.response_id).first()
    factors = db.query(Factor).filter(Factor.project_id == project_id).all()
    runs = db.query(DOERun).filter(DOERun.design_id == request.design_id).all()
    
    if not design or not response or not runs:
        raise HTTPException(status_code=400, detail="Missing design, response, or runs")
        
    data = []
    for r in runs:
        if r.missing or r.failed:
            continue
        val = None
        if r.response_values:
            if response.name in r.response_values:
                val = r.response_values[response.name]
            elif response.code in r.response_values:
                val = r.response_values[response.code]
        if val is None:
            continue
            
        row = r.coded_values.copy()
        row[response.code] = float(val)
        data.append(row)
        
    df = pd.DataFrame(data)
    if len(df) < len(factors) + 2:
        raise HTTPException(status_code=400, detail={"error": {"code": "INSUFFICIENT_DATA", "message": "Not enough valid runs for analysis."}})
        
    try:
        result = StatisticalEngine.analyze(df, response.code, factors, request.model_type, request.transformation)
    except ValueError as e:
        raise HTTPException(status_code=400, detail={"error": {"code": "MODEL_ERROR", "message": str(e)}})
        
    d_hash = compute_dataset_hash(runs, response)
    metrics_data = result["metrics"].copy() if isinstance(result.get("metrics"), dict) else {}
    metrics_data["data_hash"] = d_hash
    metrics_data["is_stale"] = False

    diagnostics_data = result["diagnostics"].copy() if isinstance(result.get("diagnostics"), dict) else {}
    diagnostics_data["data_hash"] = d_hash

    analysis = models.Analysis(
        project_id=project_id,
        design_id=request.design_id,
        response_id=request.response_id,
        model_type=request.model_type,
        transformation=request.transformation,
        coefficients=result["coefficients"],
        anova=result["anova"],
        metrics=metrics_data,
        diagnostics=diagnostics_data,
        created_at=datetime.utcnow().isoformat()
    )
    db.add(analysis)
    db.commit()
    db.refresh(analysis)
    analysis.is_stale = False
    analysis.data_hash = d_hash
    return analysis

@project_router.get("/", response_model=List[schemas.AnalysisResult])
def get_analyses(project_id: int, db: Session = Depends(get_db)):
    analyses = db.query(models.Analysis).filter(models.Analysis.project_id == project_id).order_by(models.Analysis.id.desc()).all()
    
    design_runs_cache = {}
    responses_cache = {}
    
    for a in analyses:
        if a.design_id not in design_runs_cache:
            design_runs_cache[a.design_id] = db.query(DOERun).filter(DOERun.design_id == a.design_id).all()
        if a.response_id not in responses_cache:
            responses_cache[a.response_id] = db.query(ResponseModel).filter(ResponseModel.id == a.response_id).first()
            
        runs = design_runs_cache.get(a.design_id, [])
        resp = responses_cache.get(a.response_id)
        
        cur_hash = compute_dataset_hash(runs, resp) if resp and runs else None
        stored_hash = a.metrics.get("data_hash") if isinstance(a.metrics, dict) else None
        
        a.is_stale = (stored_hash is None or stored_hash != cur_hash)
        a.data_hash = stored_hash
        
    return analyses
