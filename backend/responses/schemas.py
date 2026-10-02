from pydantic import BaseModel, model_validator
from typing import Optional

class ResponseBase(BaseModel):
    name: str
    code: str
    unit: Optional[str] = None
    target_type: str
    target: Optional[float] = None
    lower_limit: Optional[float] = None
    upper_limit: Optional[float] = None
    importance: int
    description: Optional[str] = None

    @model_validator(mode='after')
    def validate_response(self):
        if self.target_type not in ["MAXIMIZE", "MINIMIZE", "TARGET", "RANGE"]:
            raise ValueError("target_type must be one of: MAXIMIZE, MINIMIZE, TARGET, RANGE")
        if not (1 <= self.importance <= 5):
             raise ValueError("importance must be between 1 and 5")
        
        if self.target_type == "RANGE":
            if self.lower_limit is None or self.upper_limit is None:
                raise ValueError("RANGE target_type requires both lower_limit and upper_limit")
            if self.lower_limit >= self.upper_limit:
                raise ValueError("upper_limit must be strictly greater than lower_limit")
        elif self.target_type == "TARGET":
             if self.target is None:
                 raise ValueError("TARGET target_type requires a target value")
        
        return self

class ResponseCreate(ResponseBase):
    pass

class ResponseUpdate(ResponseBase):
    pass

class Response(ResponseBase):
    id: int
    project_id: int

    class Config:
        from_attributes = True
