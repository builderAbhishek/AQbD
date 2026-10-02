from sqlalchemy import Column, Integer, String, Float, Text, ForeignKey
from sqlalchemy.orm import relationship
from core.database import Base

class ResponseModel(Base):
    __tablename__ = "responses"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    name = Column(String, nullable=False)
    code = Column(String, nullable=False)
    unit = Column(String, nullable=True)
    target_type = Column(String, nullable=False) # MAXIMIZE, MINIMIZE, TARGET, RANGE
    target = Column(Float, nullable=True)
    lower_limit = Column(Float, nullable=True)
    upper_limit = Column(Float, nullable=True)
    importance = Column(Integer, nullable=False) # e.g. 1-5
    description = Column(Text, nullable=True)

    project = relationship("Project", back_populates="responses")
