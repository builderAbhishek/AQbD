from sqlalchemy import Column, Integer, String, JSON, ForeignKey
from sqlalchemy.orm import relationship
from core.database import Base

class DesignSpace(Base):
    __tablename__ = "design_spaces"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    analysis_ids = Column(JSON, nullable=False) # List of models used
    constraints = Column(JSON, nullable=False)
    grid_resolution = Column(Integer, default=50)
    space_data = Column(JSON, nullable=False) # Acceptable/Unacceptable grid points
    created_at = Column(String, nullable=False)

    project = relationship("Project", back_populates="design_spaces")
