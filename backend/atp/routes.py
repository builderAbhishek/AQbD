from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from core.database import get_db
from atp import models, schemas
from projects.models import Project

router = APIRouter(prefix="/atp", tags=["ATP"])
project_router = APIRouter(prefix="/projects/{project_id}/atp", tags=["ATP"])

@project_router.post("/", response_model=schemas.ATPParameter, status_code=status.HTTP_201_CREATED)
def create_atp_parameter(project_id: int, atp: schemas.ATPParameterCreate, db: Session = Depends(get_db)):
    db_project = db.query(Project).filter(Project.id == project_id).first()
    if not db_project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    db_atp = models.ATPParameter(**atp.model_dump(), project_id=project_id)
    db.add(db_atp)
    db.commit()
    db.refresh(db_atp)
    return db_atp

@project_router.get("/", response_model=List[schemas.ATPParameter])
def get_atp_parameters(project_id: int, db: Session = Depends(get_db)):
    db_project = db.query(Project).filter(Project.id == project_id).first()
    if not db_project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    return db.query(models.ATPParameter).filter(models.ATPParameter.project_id == project_id).all()

@router.put("/{atp_id}", response_model=schemas.ATPParameter)
def update_atp_parameter(atp_id: int, atp: schemas.ATPParameterUpdate, db: Session = Depends(get_db)):
    db_atp = db.query(models.ATPParameter).filter(models.ATPParameter.id == atp_id).first()
    if not db_atp:
        raise HTTPException(status_code=404, detail="ATP Parameter not found")
    
    update_data = atp.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_atp, key, value)
    
    db.commit()
    db.refresh(db_atp)
    return db_atp

@router.delete("/{atp_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_atp_parameter(atp_id: int, db: Session = Depends(get_db)):
    db_atp = db.query(models.ATPParameter).filter(models.ATPParameter.id == atp_id).first()
    if not db_atp:
        raise HTTPException(status_code=404, detail="ATP Parameter not found")
    
    db.delete(db_atp)
    db.commit()
    return None
