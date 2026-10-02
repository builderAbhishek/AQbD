from pydantic import BaseModel, model_validator
from typing import Optional

class ATPParameterBase(BaseModel):
    name: str
    description: Optional[str] = None
    target_type: str
    target_value: Optional[float] = None
    lower_limit: Optional[float] = None
    upper_limit: Optional[float] = None
    unit: Optional[str] = None
    criticality: Optional[str] = None
    justification: Optional[str] = None

    @model_validator(mode='after')
    def validate_limits(self):
        if self.target_type not in ["MINIMUM", "MAXIMUM", "TARGET", "RANGE"]:
            raise ValueError("target_type must be one of: MINIMUM, MAXIMUM, TARGET, RANGE")
        
        if self.target_type == "RANGE":
            if self.lower_limit is None or self.upper_limit is None:
                raise ValueError("RANGE target_type requires both lower_limit and upper_limit")
            if self.lower_limit >= self.upper_limit:
                raise ValueError("upper_limit must be strictly greater than lower_limit")
        elif self.target_type in ["MINIMUM", "MAXIMUM", "TARGET"]:
            if self.target_value is None and self.lower_limit is None and self.upper_limit is None:
                 pass # Allow flexible usage, but ideally one should be provided.
        return self

class ATPParameterCreate(ATPParameterBase):
    pass

class ATPParameterUpdate(ATPParameterBase):
    pass

class ATPParameter(ATPParameterBase):
    id: int
    project_id: int

    class Config:
        from_attributes = True
