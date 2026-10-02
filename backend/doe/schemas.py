from pydantic import BaseModel
from typing import Optional, List, Dict, Any

class DOEGenerateRequest(BaseModel):
    design_type: str # FULL_FACTORIAL, GENERAL_FACTORIAL, CCD, BBD
    center_points: int = 0
    alpha: str = "o" # Rotatable, orthogonal
    face: str = "ccf" # ccc, cci, ccf
    seed: Optional[int] = None

class DOEDesignBase(BaseModel):
    design_type: str
    factor_mapping: List[Dict[str, Any]]
    coded_matrix: List[List[float]]
    actual_matrix: List[List[float]]
    random_seed: Optional[int] = None
    randomized_order: List[int]
    standard_order: List[int]
    center_point_count: int
    block_information: Optional[Dict[str, Any]] = None

class DOEDesign(DOEDesignBase):
    id: int
    project_id: int
    software_version: str
    created_at: str

    class Config:
        from_attributes = True
