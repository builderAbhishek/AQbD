from sqlalchemy import Column, Integer, String, JSON, ForeignKey
from sqlalchemy.orm import relationship
from core.database import Base

class Analysis(Base):
    __tablename__ = "analyses"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    design_id = Column(Integer, ForeignKey("doe_designs.id"), nullable=False)
    response_id = Column(Integer, ForeignKey("responses.id"), nullable=False)
    model_type = Column(String, nullable=False) # FIRST_ORDER, INTERACTIONS, QUADRATIC
    transformation = Column(String, default="NONE") # NONE, LOG, SQRT, INVERSE
    coefficients = Column(JSON, nullable=False) # List of dicts: {term, coef, se, t, p, ci_low, ci_high}
    anova = Column(JSON, nullable=False)
    diagnostics = Column(JSON, nullable=False)
    metrics = Column(JSON, nullable=False) # R2, Adjusted R2, etc.
    analysis_version = Column(Integer, default=1)
    software_version = Column(String, default="1.0.0")
    created_at = Column(String, nullable=False)

    project = relationship("Project", back_populates="analyses")
    design = relationship("DOEDesign")
    response = relationship("ResponseModel")

    @property
    def data_hash(self):
        val = getattr(self, "_data_hash", None)
        if val is not None:
            return val
        if isinstance(self.metrics, dict):
            return self.metrics.get("data_hash")
        return None

    @data_hash.setter
    def data_hash(self, val):
        self._data_hash = val

    @property
    def is_stale(self):
        val = getattr(self, "_is_stale", None)
        if val is not None:
            return val
        if isinstance(self.metrics, dict):
            return self.metrics.get("is_stale", False)
        return False

    @is_stale.setter
    def is_stale(self, val):
        self._is_stale = val
