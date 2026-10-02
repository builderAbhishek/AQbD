from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from core.database import get_db
from factors import models, schemas
from projects.models import Project

router = APIRouter(prefix="/factors", tags=["Factors"])
project_router = APIRouter(prefix="/projects/{project_id}/factors", tags=["Factors"])

@project_router.post("/", response_model=schemas.Factor, status_code=status.HTTP_201_CREATED)
def create_factor(project_id: int, factor: schemas.FactorCreate, db: Session = Depends(get_db)):
    db_project = db.query(Project).filter(Project.id == project_id).first()
    if not db_project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    db_factor = models.Factor(**factor.model_dump(), project_id=project_id)
    db.add(db_factor)
    db.commit()
    db.refresh(db_factor)
    return db_factor

@project_router.get("/", response_model=List[schemas.Factor])
def get_factors(project_id: int, db: Session = Depends(get_db)):
    db_project = db.query(Project).filter(Project.id == project_id).first()
    if not db_project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    return db.query(models.Factor).filter(models.Factor.project_id == project_id).all()

@router.put("/{factor_id}", response_model=schemas.Factor)
def update_factor(factor_id: int, factor: schemas.FactorUpdate, db: Session = Depends(get_db)):
    db_factor = db.query(models.Factor).filter(models.Factor.id == factor_id).first()
    if not db_factor:
        raise HTTPException(status_code=404, detail="Factor not found")
    
    update_data = factor.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_factor, key, value)
    
    db.commit()
    db.refresh(db_factor)
    return db_factor

@router.delete("/{factor_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_factor(factor_id: int, db: Session = Depends(get_db)):
    db_factor = db.query(models.Factor).filter(models.Factor.id == factor_id).first()
    if not db_factor:
        raise HTTPException(status_code=404, detail="Factor not found")
    
    db.delete(db_factor)
    db.commit()
    return None
