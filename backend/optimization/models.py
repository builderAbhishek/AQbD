from sqlalchemy import Column, Integer, String, Float, JSON, ForeignKey
from sqlalchemy.orm import relationship
from core.database import Base

class OptimizationRun(Base):
    __tablename__ = "optimization_runs"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    analysis_id = Column(Integer, ForeignKey("analyses.id"), nullable=False)
    settings = Column(JSON, nullable=False) # Store the optimization goals/weights
    candidates = Column(JSON, nullable=False) # List of best factor settings & predictions
    created_at = Column(String, nullable=False)

    project = relationship("Project", back_populates="optimization_runs")
    analysis = relationship("Analysis")

class ConfirmationRun(Base):
    __tablename__ = "confirmation_runs"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    optimization_id = Column(Integer, ForeignKey("optimization_runs.id"), nullable=False)
    predicted_values = Column(JSON, nullable=False)
    actual_values = Column(JSON, nullable=False)
    differences = Column(JSON, nullable=False)
    data_source = Column(String, nullable=False, default="SIMULATED")  # SIMULATED or EXPERIMENTAL
    created_at = Column(String, nullable=False)

    project = relationship("Project", back_populates="confirmation_runs")

