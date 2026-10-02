from sqlalchemy import Column, Integer, String, Float, Text, ForeignKey
from sqlalchemy.orm import relationship
from core.database import Base

class ATPParameter(Base):
    __tablename__ = "atp_parameters"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    name = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    target_type = Column(String, nullable=False) # MINIMUM, MAXIMUM, TARGET, RANGE
    target_value = Column(Float, nullable=True)
    lower_limit = Column(Float, nullable=True)
    upper_limit = Column(Float, nullable=True)
    unit = Column(String, nullable=True)
    criticality = Column(String, nullable=True) # e.g. Critical, Important, Non-Critical
    justification = Column(Text, nullable=True)

    project = relationship("Project", back_populates="atp_parameters")
