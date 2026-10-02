from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy.orm import Session
from typing import List, Dict, Any

from core.database import get_db
from experiments import models
from doe.models import DOEDesign
from pydantic import BaseModel
import pandas as pd
import io

router = APIRouter(prefix="/experiments", tags=["Experiments"])
doe_router = APIRouter(prefix="/doe/{design_id}/runs", tags=["Experiments"])

class DOERunUpdate(BaseModel):
    response_values: Dict[str, float]
    notes: str = None
    failed: bool = False
    missing: bool = False

@doe_router.get("/")
def get_runs(design_id: int, db: Session = Depends(get_db)):
    runs = db.query(models.DOERun).filter(models.DOERun.design_id == design_id).order_by(models.DOERun.run_order).all()
    return runs

@router.put("/{run_id}")
def update_run(run_id: int, run_update: DOERunUpdate, db: Session = Depends(get_db)):
    db_run = db.query(models.DOERun).filter(models.DOERun.id == run_id).first()
    if not db_run:
        raise HTTPException(status_code=404, detail="Run not found")
    
    db_run.response_values = run_update.response_values
    if run_update.notes is not None:
        db_run.notes = run_update.notes
    db_run.failed = run_update.failed
    db_run.missing = run_update.missing
    
    db.commit()
    db.refresh(db_run)
    return db_run

@doe_router.post("/import")
async def import_results(design_id: int, file: UploadFile = File(...), mapping: str = None, db: Session = Depends(get_db)):
    # Very basic CSV import logic
    import json
    if not mapping:
        raise HTTPException(status_code=400, detail="Mapping required")
    mapping_dict = json.loads(mapping) # e.g. {"Resolution": "R1_col"}
    
    content = await file.read()
    if file.filename.endswith('.csv'):
        df = pd.read_csv(io.StringIO(content.decode('utf-8')))
    elif file.filename.endswith('.xlsx'):
        df = pd.read_excel(io.BytesIO(content))
    else:
        raise HTTPException(status_code=400, detail="Unsupported file format")

    runs = db.query(models.DOERun).filter(models.DOERun.design_id == design_id).order_by(models.DOERun.run_order).all()
    if len(runs) != len(df):
        raise HTTPException(status_code=400, detail={"error": {"code": "RUN_COUNT_MISMATCH", "message": f"File has {len(df)} rows, but design has {len(runs)} runs."}})
    
    for i, run in enumerate(runs):
        resp_vals = run.response_values or {}
        for resp_name, col_name in mapping_dict.items():
            if col_name in df.columns:
                val = df.iloc[i][col_name]
                if pd.isna(val):
                    run.missing = True
                else:
                    resp_vals[resp_name] = float(val)
        run.response_values = resp_vals
    
    db.commit()
    return {"message": "Import successful"}
