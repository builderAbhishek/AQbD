from sqlalchemy import Column, Integer, String, Text, ForeignKey, JSON
from sqlalchemy.orm import relationship
from core.database import Base

class DOEDesign(Base):
    __tablename__ = "doe_designs"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    design_type = Column(String, nullable=False) # FULL_FACTORIAL, GENERAL_FACTORIAL, CCD, BBD
    factor_mapping = Column(JSON, nullable=False) # list of factor IDs and their code/roles
    coded_matrix = Column(JSON, nullable=False) # 2D array
    actual_matrix = Column(JSON, nullable=False) # 2D array
    random_seed = Column(Integer, nullable=True)
    randomized_order = Column(JSON, nullable=False) # List of indices
    standard_order = Column(JSON, nullable=False) # List of indices
    center_point_count = Column(Integer, default=0)
    block_information = Column(JSON, nullable=True)
    software_version = Column(String, default="1.0.0")
    created_at = Column(String, nullable=False) # Store ISO format

    project = relationship("Project", back_populates="doe_designs")
    runs = relationship("DOERun", back_populates="design", cascade="all, delete-orphan")
