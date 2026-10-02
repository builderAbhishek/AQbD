from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from core.database import get_db
from responses import models, schemas
from projects.models import Project

router = APIRouter(prefix="/responses", tags=["Responses"])
project_router = APIRouter(prefix="/projects/{project_id}/responses", tags=["Responses"])

@project_router.post("/", response_model=schemas.Response, status_code=status.HTTP_201_CREATED)
def create_response(project_id: int, response: schemas.ResponseCreate, db: Session = Depends(get_db)):
    db_project = db.query(Project).filter(Project.id == project_id).first()
    if not db_project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    db_response = models.ResponseModel(**response.model_dump(), project_id=project_id)
    db.add(db_response)
    db.commit()
    db.refresh(db_response)
    return db_response

@project_router.get("/", response_model=List[schemas.Response])
def get_responses(project_id: int, db: Session = Depends(get_db)):
    db_project = db.query(Project).filter(Project.id == project_id).first()
    if not db_project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    return db.query(models.ResponseModel).filter(models.ResponseModel.project_id == project_id).all()

@router.put("/{response_id}", response_model=schemas.Response)
def update_response(response_id: int, response: schemas.ResponseUpdate, db: Session = Depends(get_db)):
    db_response = db.query(models.ResponseModel).filter(models.ResponseModel.id == response_id).first()
    if not db_response:
        raise HTTPException(status_code=404, detail="Response not found")
    
    update_data = response.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_response, key, value)
    
    db.commit()
    db.refresh(db_response)
    return db_response

@router.delete("/{response_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_response(response_id: int, db: Session = Depends(get_db)):
    db_response = db.query(models.ResponseModel).filter(models.ResponseModel.id == response_id).first()
    if not db_response:
        raise HTTPException(status_code=404, detail="Response not found")
    
    db.delete(db_response)
    db.commit()
    return None
