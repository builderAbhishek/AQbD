from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime

from core.database import get_db
from reports import models
from reports.service import ReportGenerator
from projects.models import Project
from pydantic import BaseModel

router = APIRouter(prefix="/reports", tags=["Reports"])
project_router = APIRouter(prefix="/projects/{project_id}/reports", tags=["Reports"])

class ReportResponse(BaseModel):
    id: int
    project_id: int
    file_path: str
    created_at: str

    class Config:
        from_attributes = True

@project_router.post("/", response_model=ReportResponse)
def generate_report(project_id: int, db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    from atp.models import ATPParameter
    from risk.models import RiskAssessment
    from factors.models import Factor
    from responses.models import ResponseModel
    from doe.models import DOEDesign
    from analysis.models import Analysis
    from optimization.models import OptimizationRun, ConfirmationRun
    from design_space.models import DesignSpace

    atp_items = db.query(ATPParameter).filter(ATPParameter.project_id == project_id).all()
    risk_items = db.query(RiskAssessment).filter(RiskAssessment.project_id == project_id).all()
    factor_items = db.query(Factor).filter(Factor.project_id == project_id).all()
    resp_items = db.query(ResponseModel).filter(ResponseModel.project_id == project_id).all()
    
    # Get active DOE (latest)
    doe_items = db.query(DOEDesign).filter(DOEDesign.project_id == project_id).order_by(DOEDesign.id.desc()).all()
    active_doe = doe_items[0] if doe_items else None
    
    # Get active models (latest per response)
    all_analyses = db.query(Analysis).filter(Analysis.project_id == project_id).all()
    # Group by response_id and get the one with the max id
    latest_analyses_map = {}
    for a in all_analyses:
        if a.response_id not in latest_analyses_map or a.id > latest_analyses_map[a.response_id].id:
            latest_analyses_map[a.response_id] = a
    
    active_analyses = list(latest_analyses_map.values())
    historical_model_count = len(all_analyses) - len(active_analyses)
    
    # Get active Optimization (latest)
    opt_items = db.query(OptimizationRun).filter(OptimizationRun.project_id == project_id).order_by(OptimizationRun.id.desc()).all()
    active_opt = opt_items[0] if opt_items else None
    
    # Get active Design Space (latest)
    ds_items = db.query(DesignSpace).filter(DesignSpace.project_id == project_id).order_by(DesignSpace.id.desc()).all()
    active_ds = ds_items[0] if ds_items else None
    
    conf_items = db.query(ConfirmationRun).filter(ConfirmationRun.project_id == project_id).all()

    project_data = {
        "project_code": project.project_code,
        "project_name": project.project_name,
        "atp": [{"name": a.name, "target_type": a.target_type, "unit": a.unit, "lower_limit": a.lower_limit, "upper_limit": a.upper_limit, "target_value": a.target_value} for a in atp_items],
        "risks": [{"parameter": r.parameter, "severity": r.severity, "occurrence": r.occurrence, "detectability": r.detectability, "risk_score": r.risk_score, "priority": r.priority} for r in risk_items],
        "factors": [{"code": f.code, "name": f.name, "unit": f.unit, "low_value": f.low_value, "high_value": f.high_value, "role": f.role} for f in factor_items],
        "responses": [{"code": r.code, "name": r.name, "unit": r.unit, "target_type": r.target_type, "target": r.target, "lower_limit": r.lower_limit, "upper_limit": r.upper_limit, "importance": r.importance} for r in resp_items],
        "active_doe": {"id": active_doe.id, "design_type": active_doe.design_type, "run_count": len(active_doe.standard_order), "seed": active_doe.random_seed} if active_doe else None,
        "active_analyses": [{"id": a.id, "response_id": a.response_id, "model_type": a.model_type, "metrics": a.metrics, "coefficients": a.coefficients} for a in active_analyses],
        "historical_model_count": historical_model_count,
        "active_optimization": {"id": active_opt.id, "candidates": active_opt.candidates} if active_opt else None,
        "active_design_space": {"id": active_ds.id, "grid_resolution": active_ds.grid_resolution, "space_data": active_ds.space_data} if active_ds else None,
        "confirmations": [{"id": c.id, "predicted": c.predicted_values, "actual": c.actual_values, "diffs": c.differences, "data_source": getattr(c, 'data_source', 'SIMULATED')} for c in conf_items]
    }

    try:
        filepath = ReportGenerator.generate_pdf(project_id, project_data, "generated_reports")
    except Exception as e:
        raise HTTPException(status_code=500, detail={"error": {"code": "REPORT_GENERATION_FAILED", "message": str(e)}})

    db_report = models.Report(
        project_id=project_id,
        file_path=filepath,
        created_at=datetime.utcnow().isoformat()
    )
    db.add(db_report)
    db.commit()
    db.refresh(db_report)
    
    return db_report

import os
from fastapi.responses import FileResponse

@project_router.get("/", response_model=List[ReportResponse])
def get_reports(project_id: int, db: Session = Depends(get_db)):
    return db.query(models.Report).filter(models.Report.project_id == project_id).all()

@router.get("/download/{report_id}")
def download_report(report_id: int, db: Session = Depends(get_db)):
    report = db.query(models.Report).filter(models.Report.id == report_id).first()
    if not report or not report.file_path:
        raise HTTPException(status_code=404, detail="Report not found")
    if not os.path.exists(report.file_path):
        raise HTTPException(status_code=404, detail="Report file not found on disk")
    return FileResponse(
        report.file_path,
        media_type="application/pdf",
        filename=os.path.basename(report.file_path)
    )

@router.delete("/{report_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_report(report_id: int, db: Session = Depends(get_db)):
    db_report = db.query(models.Report).filter(models.Report.id == report_id).first()
    if db_report is None:
        raise HTTPException(status_code=404, detail="Report not found")
    
    file_path = db_report.file_path
    
    try:
        db.delete(db_report)
        db.commit()
    except Exception:
        db.rollback()
        raise HTTPException(status_code=500, detail="Database deletion failed")
        
    try:
        if file_path and os.path.exists(file_path):
            os.remove(file_path)
    except OSError:
        pass # Best effort
        
    return None
