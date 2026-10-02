from pydantic import BaseModel, model_validator
from typing import Optional

class RiskAssessmentBase(BaseModel):
    parameter: str
    potential_impact: Optional[str] = None
    severity: int
    occurrence: int
    detectability: int
    priority: str
    justification: Optional[str] = None

    @model_validator(mode='after')
    def validate_risk(self):
        if not (1 <= self.severity <= 10):
            raise ValueError("Severity must be between 1 and 10")
        if not (1 <= self.occurrence <= 10):
            raise ValueError("Occurrence must be between 1 and 10")
        if not (1 <= self.detectability <= 10):
            raise ValueError("Detectability must be between 1 and 10")
        if self.priority not in ["Low", "Medium", "High", "Critical"]:
            raise ValueError("Priority must be one of: Low, Medium, High, Critical")
        return self

class RiskAssessmentCreate(RiskAssessmentBase):
    pass

class RiskAssessmentUpdate(RiskAssessmentBase):
    pass

class RiskAssessment(RiskAssessmentBase):
    id: int
    project_id: int
    risk_score: int

    class Config:
        from_attributes = True
