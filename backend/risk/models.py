from sqlalchemy import Column, Integer, String, Text, ForeignKey
from sqlalchemy.orm import relationship
from core.database import Base

class RiskAssessment(Base):
    __tablename__ = "risk_assessments"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    parameter = Column(String, nullable=False)
    potential_impact = Column(Text, nullable=True)
    severity = Column(Integer, nullable=False)
    occurrence = Column(Integer, nullable=False)
    detectability = Column(Integer, nullable=False)
    risk_score = Column(Integer, nullable=False)
    priority = Column(String, nullable=False) # Low, Medium, High, Critical
    justification = Column(Text, nullable=True)

    project = relationship("Project", back_populates="risk_assessments")
