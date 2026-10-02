from sqlalchemy import Column, Integer, String, DateTime, Text, Float
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from core.database import Base

class Project(Base):
    __tablename__ = "projects"

    id = Column(Integer, primary_key=True, index=True)
    project_code = Column(String, unique=True, index=True, nullable=False)
    project_name = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    product_name = Column(String, nullable=True)
    analyst_name = Column(String, nullable=True)
    organization = Column(String, nullable=True)
    status = Column(String, default="Draft") # Draft, In Progress, Completed, Archived
    version = Column(Integer, default=1)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    atp_parameters = relationship("ATPParameter", back_populates="project", cascade="all, delete-orphan")
    risk_assessments = relationship("RiskAssessment", back_populates="project", cascade="all, delete-orphan")
    factors = relationship("Factor", back_populates="project", cascade="all, delete-orphan")
    responses = relationship("ResponseModel", back_populates="project", cascade="all, delete-orphan")
    doe_designs = relationship("DOEDesign", back_populates="project", cascade="all, delete-orphan")
    analyses = relationship("Analysis", back_populates="project", cascade="all, delete-orphan")
    optimization_runs = relationship("OptimizationRun", back_populates="project", cascade="all, delete-orphan")
    confirmation_runs = relationship("ConfirmationRun", back_populates="project", cascade="all, delete-orphan")
    design_spaces = relationship("DesignSpace", back_populates="project", cascade="all, delete-orphan")
    reports = relationship("Report", back_populates="project", cascade="all, delete-orphan")
