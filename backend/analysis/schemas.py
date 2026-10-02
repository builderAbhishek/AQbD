from pydantic import BaseModel
from typing import Optional, List, Dict, Any

class AnalyzeRequest(BaseModel):
    design_id: int
    response_id: int
    model_type: str # FIRST_ORDER, INTERACTIONS, QUADRATIC
    transformation: str = "NONE"

class AnalysisResult(BaseModel):
    id: int
    project_id: int
    design_id: int
    response_id: int
    model_type: str
    transformation: str
    coefficients: List[Dict[str, Any]]
    anova: List[Dict[str, Any]]
    diagnostics: Dict[str, Any]
    metrics: Dict[str, Any]
    analysis_version: int
    software_version: str
    created_at: str
    is_stale: bool = False
    data_hash: Optional[str] = None

    class Config:
        from_attributes = True
