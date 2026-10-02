from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime

from core.database import get_db
from design_space import models, schemas
from design_space.service import DesignSpaceEngine
from factors.models import Factor
from analysis.models import Analysis
from responses.models import ResponseModel

router = APIRouter(prefix="/design-space", tags=["Design Space"])
project_router = APIRouter(prefix="/projects/{project_id}/design-space", tags=["Design Space"])

@project_router.post("/", response_model=schemas.DesignSpaceResult, status_code=status.HTTP_201_CREATED)
def calculate_design_space(project_id: int, request: schemas.DesignSpaceCalculateRequest, db: Session = Depends(get_db)):
    factors = db.query(Factor).filter(Factor.project_id == project_id).all()
    if not factors:
        raise HTTPException(status_code=400, detail="Missing factors for design space generation.")

    # 1. Defensive validation for duplicate response_ids in request
    if request.response_ids:
        if len(request.response_ids) != len(set(request.response_ids)):
            raise HTTPException(
                status_code=400,
                detail="Duplicate response IDs submitted in design space calculation request. Each response must appear at most once."
            )

    # 2. Defensive validation for duplicate analysis_ids in request
    if request.analysis_ids:
        if len(request.analysis_ids) != len(set(request.analysis_ids)):
            raise HTTPException(
                status_code=400,
                detail="Duplicate analysis IDs submitted in design space calculation request. Each model must appear at most once."
            )

    analyses = []
    if request.analysis_ids:
        analyses = db.query(Analysis).filter(
            Analysis.id.in_(request.analysis_ids),
            Analysis.project_id == project_id
        ).all()
        if len(analyses) != len(request.analysis_ids):
            raise HTTPException(status_code=400, detail="One or more selected analyses were not found for this project.")
    elif request.response_ids:
        for resp_id in request.response_ids:
            a = db.query(Analysis).filter(
                Analysis.project_id == project_id,
                Analysis.response_id == resp_id
            ).order_by(Analysis.id.desc()).first()
            if not a:
                resp = db.query(ResponseModel).filter(ResponseModel.id == resp_id).first()
                resp_label = f"{resp.name} ({resp.code})" if resp else f"ID {resp_id}"
                raise HTTPException(status_code=400, detail=f"No fitted model found for response {resp_label}.")
            analyses.append(a)

    if not analyses:
        raise HTTPException(status_code=400, detail="Missing factors or analyses for design space generation")

    # 3. Defensive validation: Ensure no duplicate response_ids across selected analyses
    seen_response_ids = set()
    for a in analyses:
        if a.response_id in seen_response_ids:
            resp = db.query(ResponseModel).filter(ResponseModel.id == a.response_id).first()
            resp_label = f"{resp.name} ({resp.code})" if resp else f"ID {a.response_id}"
            raise HTTPException(
                status_code=400,
                detail=f"Duplicate response constraint for {resp_label}. Exactly one model per unique response is allowed for design space calculation."
            )
        seen_response_ids.add(a.response_id)

    # 4. If both response_ids and analysis_ids were provided, ensure they match exactly
    if request.response_ids:
        if set(request.response_ids) != seen_response_ids:
            raise HTTPException(
                status_code=400,
                detail="Selected response IDs do not match the responses associated with the provided analysis IDs."
            )

    models_data = []
    for a in analyses:
        resp = db.query(ResponseModel).filter(ResponseModel.id == a.response_id).first()
        if not resp:
            continue
        models_data.append({
            "response_code": resp.code,
            "coefs": a.coefficients,
            "model_type": a.model_type,
            "transformation": a.transformation,
            "target_type": resp.target_type,
            "target": float(resp.target) if resp.target is not None else None,
            "lower_limit": float(resp.lower_limit) if resp.lower_limit is not None else None,
            "upper_limit": float(resp.upper_limit) if resp.upper_limit is not None else None,
            "importance": float(resp.importance) if resp.importance is not None else 3.0
        })

    # Apply custom constraints from request if provided
    constraints = request.constraints or {}
    if constraints:
        for md in models_data:
            code = md["response_code"]
            if code in constraints:
                c = constraints[code]
                if "lower" in c and c["lower"] is not None:
                    md["lower_limit"] = float(c["lower"])
                if "upper" in c and c["upper"] is not None:
                    md["upper_limit"] = float(c["upper"])
                if "target_type" in c and c["target_type"]:
                    md["target_type"] = c["target_type"]

    resolved_analysis_ids = [a.id for a in analyses]
    grid_res = request.grid_resolution or 20

    space_output = DesignSpaceEngine.calculate_space(
        factors=factors,
        models_data=models_data,
        constraints=constraints,
        resolution=grid_res,
        resolution_3d=request.grid_resolution_3d or 20,
        slice_axis_x=request.slice_axis_x,
        slice_axis_y=request.slice_axis_y,
        fixed_factors=request.fixed_factors
    )

    # Check membership of latest optimization setpoint in true 3D space
    from optimization import models as opt_models
    latest_opt = db.query(opt_models.OptimizationRun).filter(
        opt_models.OptimizationRun.project_id == project_id
    ).order_by(opt_models.OptimizationRun.id.desc()).first()

    opt_check = None
    if latest_opt and latest_opt.candidates and len(latest_opt.candidates) > 0:
        opt_factors = latest_opt.candidates[0].get("factors")
        if opt_factors:
            opt_check = DesignSpaceEngine.verify_point_membership(
                factors=factors,
                models_data=models_data,
                factor_values=opt_factors,
                threshold=0.05
            )
            opt_check["setpoints"] = opt_factors
            opt_check["optimization_id"] = latest_opt.id
            opt_check["overall_desirability"] = latest_opt.candidates[0].get("overall_desirability")

            # Check whether optimal setpoint is on the active 2D slice plane
            fixed_factors = space_output.get("slice_data", {}).get("fixed_factors", {})
            is_on_slice = True
            slice_diffs = {}
            for code, fixed_val in fixed_factors.items():
                if code in opt_factors:
                    diff = abs(opt_factors[code] - fixed_val)
                    slice_diffs[code] = diff
                    if diff > 0.25:
                        is_on_slice = False
            opt_check["is_on_active_slice"] = is_on_slice
            opt_check["slice_diffs"] = slice_diffs

    space_output["optimization_point_check"] = opt_check

    db_space = models.DesignSpace(
        project_id=project_id,
        analysis_ids=resolved_analysis_ids,
        constraints=constraints,
        grid_resolution=grid_res,
        space_data=space_output,
        created_at=datetime.utcnow().isoformat()
    )
    db.add(db_space)
    db.commit()
    db.refresh(db_space)
    return db_space

@project_router.get("/", response_model=List[schemas.DesignSpaceResult])
def get_design_spaces(project_id: int, db: Session = Depends(get_db)):
    return db.query(models.DesignSpace).filter(models.DesignSpace.project_id == project_id).order_by(models.DesignSpace.id.desc()).all()
