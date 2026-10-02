from pydantic import BaseModel
from typing import Optional, List, Dict, Any

class DesignSpaceCalculateRequest(BaseModel):
    analysis_ids: Optional[List[int]] = None
    response_ids: Optional[List[int]] = None
    constraints: Optional[Dict[str, Any]] = None
    grid_resolution: int = 20

class DesignSpaceResult(BaseModel):
    id: int
    project_id: int
    analysis_ids: List[int]
    constraints: Dict[str, Any]
    grid_resolution: int
    space_data: Dict[str, Any]
    created_at: str

    class Config:
        from_attributes = True
