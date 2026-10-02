from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from core.database import get_db
from risk import models, schemas
from projects.models import Project

router = APIRouter(prefix="/risk", tags=["Risk Assessment"])
project_router = APIRouter(prefix="/projects/{project_id}/risk", tags=["Risk Assessment"])

@project_router.post("/", response_model=schemas.RiskAssessment, status_code=status.HTTP_201_CREATED)
def create_risk_assessment(project_id: int, risk: schemas.RiskAssessmentCreate, db: Session = Depends(get_db)):
    db_project = db.query(Project).filter(Project.id == project_id).first()
    if not db_project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Calculate RPN (Risk Priority Number)
    # Note: Documented as a configurable risk-management mechanism, not an ICH-required formula.
    risk_score = risk.severity * risk.occurrence * risk.detectability
    
    db_risk = models.RiskAssessment(**risk.model_dump(), project_id=project_id, risk_score=risk_score)
    db.add(db_risk)
    db.commit()
    db.refresh(db_risk)
    return db_risk

@project_router.get("/", response_model=List[schemas.RiskAssessment])
def get_risk_assessments(project_id: int, db: Session = Depends(get_db)):
    db_project = db.query(Project).filter(Project.id == project_id).first()
    if not db_project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    return db.query(models.RiskAssessment).filter(models.RiskAssessment.project_id == project_id).all()

@router.put("/{risk_id}", response_model=schemas.RiskAssessment)
def update_risk_assessment(risk_id: int, risk: schemas.RiskAssessmentUpdate, db: Session = Depends(get_db)):
    db_risk = db.query(models.RiskAssessment).filter(models.RiskAssessment.id == risk_id).first()
    if not db_risk:
        raise HTTPException(status_code=404, detail="Risk Assessment not found")
    
    update_data = risk.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_risk, key, value)
    
    # Recalculate RPN
    db_risk.risk_score = db_risk.severity * db_risk.occurrence * db_risk.detectability
    
    db.commit()
    db.refresh(db_risk)
    return db_risk

@router.delete("/{risk_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_risk_assessment(risk_id: int, db: Session = Depends(get_db)):
    db_risk = db.query(models.RiskAssessment).filter(models.RiskAssessment.id == risk_id).first()
    if not db_risk:
        raise HTTPException(status_code=404, detail="Risk Assessment not found")
    
    db.delete(db_risk)
    db.commit()
    return None
