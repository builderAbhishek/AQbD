from pydantic import BaseModel
from typing import Optional, List, Dict, Any

class OptimizeRequest(BaseModel):
    analysis_ids: List[int]
    settings: Dict[str, Any]

class OptimizationResult(BaseModel):
    id: int
    project_id: int
    analysis_id: int
    settings: Dict[str, Any]
    candidates: List[Dict[str, Any]]
    created_at: str

    class Config:
        from_attributes = True

class ConfirmationRequest(BaseModel):
    optimization_id: int
    predicted_values: Dict[str, float]
    actual_values: Dict[str, float]
    data_source: str = "SIMULATED"  # SIMULATED or EXPERIMENTAL

class ConfirmationResult(BaseModel):
    id: int
    project_id: int
    optimization_id: int
    predicted_values: Dict[str, float]
    actual_values: Dict[str, float]
    differences: Dict[str, float]
    data_source: str = "SIMULATED"
    created_at: str

    class Config:
        from_attributes = True
