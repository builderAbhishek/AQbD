from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class ProjectBase(BaseModel):
    project_code: str
    project_name: str
    description: Optional[str] = None
    product_name: Optional[str] = None
    analyst_name: Optional[str] = None
    organization: Optional[str] = None
    status: Optional[str] = "Draft"

class ProjectCreate(ProjectBase):
    pass

class ProjectUpdate(ProjectBase):
    pass

class Project(ProjectBase):
    id: int
    version: int
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True
