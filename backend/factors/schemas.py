from pydantic import BaseModel, model_validator
from typing import Optional

class FactorBase(BaseModel):
    name: str
    code: str
    type: str
    unit: Optional[str] = None
    low_value: Optional[float] = None
    high_value: Optional[float] = None
    center_value: Optional[float] = None
    levels: Optional[int] = None
    role: str
    description: Optional[str] = None

    @model_validator(mode='after')
    def validate_factor(self):
        if self.type not in ["CONTINUOUS", "CATEGORICAL"]:
            raise ValueError("type must be CONTINUOUS or CATEGORICAL")
        if self.role not in ["CRITICAL", "IMPORTANT", "CONTROL"]:
            raise ValueError("role must be CRITICAL, IMPORTANT, or CONTROL")
        
        if self.type == "CONTINUOUS":
            if self.low_value is None or self.high_value is None:
                raise ValueError("CONTINUOUS factors require low_value and high_value")
            if self.high_value <= self.low_value:
                raise ValueError("High value must be greater than Low value.")
        elif self.type == "CATEGORICAL":
            if self.levels is None or self.levels < 2:
                raise ValueError("CATEGORICAL factors require levels >= 2")
        return self

class FactorCreate(FactorBase):
    pass

class FactorUpdate(FactorBase):
    pass

class Factor(FactorBase):
    id: int
    project_id: int

    class Config:
        from_attributes = True
