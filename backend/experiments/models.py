from sqlalchemy import Column, Integer, String, Float, ForeignKey, JSON, Boolean
from sqlalchemy.orm import relationship
from core.database import Base

class DOERun(Base):
    __tablename__ = "doe_runs"

    id = Column(Integer, primary_key=True, index=True)
    design_id = Column(Integer, ForeignKey("doe_designs.id"), nullable=False)
    standard_order = Column(Integer, nullable=False)
    run_order = Column(Integer, nullable=False)
    center_point = Column(Boolean, default=False)
    block = Column(String, nullable=True)
    factor_values = Column(JSON, nullable=False) # e.g. {"pH": 4.0, "Flow Rate": 0.8}
    coded_values = Column(JSON, nullable=False)
    response_values = Column(JSON, nullable=True) # e.g. {"Resolution": 2.5, "Tailing": 1.1}
    notes = Column(String, nullable=True)
    failed = Column(Boolean, default=False)
    missing = Column(Boolean, default=False)

    design = relationship("DOEDesign", back_populates="runs")
