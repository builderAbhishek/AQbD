from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime

from core.database import get_db
from doe import models, schemas
from doe.service import DOEEngine
from projects.models import Project
from factors.models import Factor
from experiments.models import DOERun

router = APIRouter(prefix="/doe", tags=["DOE"])
project_router = APIRouter(prefix="/projects/{project_id}/doe", tags=["DOE"])

@project_router.post("/", response_model=schemas.DOEDesign, status_code=status.HTTP_201_CREATED)
def generate_doe(project_id: int, request: schemas.DOEGenerateRequest, db: Session = Depends(get_db)):
    db_project = db.query(Project).filter(Project.id == project_id).first()
    if not db_project:
        raise HTTPException(status_code=404, detail="Project not found")

    factors = db.query(Factor).filter(Factor.project_id == project_id).all()
    if len(factors) < 2:
        raise HTTPException(status_code=400, detail={"error": {"code": "MINIMUM_FACTORS", "message": "At least 2 factors are required for DOE."}})
    
    # Sort factors by ID for consistent matrix mapping
    factors = sorted(factors, key=lambda f: f.id)
    factor_mapping = [{"id": f.id, "code": f.code, "name": f.name} for f in factors]

    try:
        if request.design_type == "FULL_FACTORIAL":
            coded, actual = DOEEngine.generate_full_factorial(factors, request.center_points)
        elif request.design_type == "GENERAL_FACTORIAL":
            coded, actual = DOEEngine.generate_general_factorial(factors)
        elif request.design_type == "CCD":
            coded, actual = DOEEngine.generate_ccd(factors, center_points=request.center_points, alpha=request.alpha, face=request.face)
        elif request.design_type == "BBD":
            if len(factors) < 3:
                raise HTTPException(status_code=400, detail={"error": {"code": "MINIMUM_FACTORS", "message": "At least 3 factors are required for Box-Behnken Design."}})
            coded, actual = DOEEngine.generate_bbd(factors, center_points=request.center_points if request.center_points > 0 else None)
        else:
            raise HTTPException(status_code=400, detail={"error": {"code": "INVALID_DESIGN", "message": "Invalid design type."}})
    except Exception as e:
        raise HTTPException(status_code=400, detail={"error": {"code": "DOE_GENERATION_FAILED", "message": str(e)}})

    std_order, run_order, seed = DOEEngine.randomize_design(len(coded), request.seed)

    db_design = models.DOEDesign(
        project_id=project_id,
        design_type=request.design_type,
        factor_mapping=factor_mapping,
        coded_matrix=coded,
        actual_matrix=actual,
        random_seed=seed,
        randomized_order=run_order,
        standard_order=std_order,
        center_point_count=request.center_points,
        created_at=datetime.utcnow().isoformat()
    )
    db.add(db_design)
    db.commit()
    db.refresh(db_design)

    # Automatically generate DOERun entries
    for i, std_idx in enumerate(std_order):
        # find the run index from randomized order
        r_order = run_order.index(std_idx) + 1
        row_coded = coded[std_idx - 1]
        row_actual = actual[std_idx - 1]
        
        factor_vals = {f["code"]: row_actual[j] for j, f in enumerate(factor_mapping)}
        coded_vals = {f["code"]: row_coded[j] for j, f in enumerate(factor_mapping)}
        
        is_center = all(v == 0.0 for v in row_coded)
        
        run = DOERun(
            design_id=db_design.id,
            standard_order=std_idx,
            run_order=r_order,
            factor_values=factor_vals,
            coded_values=coded_vals,
            center_point=is_center
        )
        db.add(run)
    db.commit()

    return db_design

@project_router.get("/", response_model=List[schemas.DOEDesign])
def get_doe_designs(project_id: int, db: Session = Depends(get_db)):
    return db.query(models.DOEDesign).filter(models.DOEDesign.project_id == project_id).all()
