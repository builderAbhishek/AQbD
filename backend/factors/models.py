from sqlalchemy import Column, Integer, String, Float, Text, ForeignKey
from sqlalchemy.orm import relationship
from core.database import Base

class Factor(Base):
    __tablename__ = "factors"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    name = Column(String, nullable=False)
    code = Column(String, nullable=False)
    type = Column(String, nullable=False) # CONTINUOUS, CATEGORICAL
    unit = Column(String, nullable=True)
    low_value = Column(Float, nullable=True)
    high_value = Column(Float, nullable=True)
    center_value = Column(Float, nullable=True)
    levels = Column(Integer, nullable=True) # Used for categorical or generic full factorial
    role = Column(String, nullable=False) # CRITICAL, IMPORTANT, CONTROL
    description = Column(Text, nullable=True)

    project = relationship("Project", back_populates="factors")
