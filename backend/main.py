from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from core.database import engine, Base
from projects.routes import router as projects_router
from atp.routes import router as atp_router
from atp.routes import project_router as project_atp_router
from risk.routes import router as risk_router
from risk.routes import project_router as project_risk_router
from factors.routes import router as factors_router
from factors.routes import project_router as project_factors_router
from responses.routes import router as responses_router
from responses.routes import project_router as project_responses_router
from doe.routes import router as doe_router
from doe.routes import project_router as project_doe_router
from experiments.routes import router as experiments_router
from experiments.routes import doe_router as doe_experiments_router
from analysis.routes import router as statistics_router
from analysis.routes import project_router as project_statistics_router
from optimization.routes import router as optimization_router
from optimization.routes import project_router as project_optimization_router
from reports.routes import router as reports_router
from reports.routes import project_router as project_reports_router
from design_space.routes import router as design_space_router
from design_space.routes import project_router as project_design_space_router

# Import all models for Base.metadata.create_all
from projects import models as projects_models
from atp import models as atp_models
from risk import models as risk_models
from factors import models as factors_models
from responses import models as responses_models
from doe import models as doe_models
from experiments import models as experiments_models
from analysis import models as statistics_models
from optimization import models as optimization_models
from design_space import models as design_space_models
from reports import models as reports_models

# Create database tables (For development/Phase 1)
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="AQbD Software API",
    description="Analytical Quality by Design (AQbD) / Design of Experiments (DOE) API",
    version="1.0.0"
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # In production, restrict to frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(projects_router, prefix="/api/v1")
app.include_router(atp_router, prefix="/api/v1")
app.include_router(project_atp_router, prefix="/api/v1")
app.include_router(risk_router, prefix="/api/v1")
app.include_router(project_risk_router, prefix="/api/v1")
app.include_router(factors_router, prefix="/api/v1")
app.include_router(project_factors_router, prefix="/api/v1")
app.include_router(responses_router, prefix="/api/v1")
app.include_router(project_responses_router, prefix="/api/v1")
app.include_router(doe_router, prefix="/api/v1")
app.include_router(project_doe_router, prefix="/api/v1")
app.include_router(experiments_router, prefix="/api/v1")
app.include_router(doe_experiments_router, prefix="/api/v1")
app.include_router(statistics_router, prefix="/api/v1")
app.include_router(project_statistics_router, prefix="/api/v1")
app.include_router(optimization_router, prefix="/api/v1")
app.include_router(project_optimization_router, prefix="/api/v1")
app.include_router(reports_router, prefix="/api/v1")
app.include_router(project_reports_router, prefix="/api/v1")
app.include_router(design_space_router, prefix="/api/v1")
app.include_router(project_design_space_router, prefix="/api/v1")

@app.get("/health")
def health_check():
    return {"status": "ok", "message": "AQbD API is running"}
