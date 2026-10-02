# AQbD Studio

## Project Overview
AQbD Studio is an ICH Q8/Q9/Q14-aligned analytical method development software prototype. It provides a systematic, statistical, and risk-based approach to analytical method development, moving beyond traditional trial-and-error (One-Factor-at-a-Time, OFAT) methodologies.

## Purpose
The problem it solves is the lack of structured, accessible software that strictly enforces the Quality by Design (QbD) workflow specifically tailored for analytical methods (AQbD).

## AQbD Workflow
1. Analytical Target Profile (ATP)
2. Risk Assessment
3. Factors & Responses Definition
4. Design of Experiments (DOE Engine)
5. Experiment Data Capture
6. Statistical Fit & Diagnostics
7. Multi-response Optimization
8. Design Space (PAR) Calculation
9. Confirmation Runs
10. Regulatory Dossier (PDF Report)

## Current Features
- Factorial, Central Composite (CCD), and Box-Behnken (BBD) Designs
- Robust OLS regression (Linear, Interactions, Quadratic)
- ANOVA and Lack of Fit testing
- Derringer-Suich desirability optimization
- Multi-dimensional feasible design space evaluation without extrapolation

## Technology Stack
- **Frontend**: React 18, Vite, TailwindCSS
- **Backend**: FastAPI, SQLAlchemy, Statsmodels, SciPy, pyDOE3
- **Database**: SQLite
- **Environment**: Docker

## Architecture
See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)

## Requirements
- Git
- Docker Desktop

## Quick Start with Docker
`Bash
git clone https://github.com/builderAbhishek/AQbD.git
cd AQbD
cp .env.example .env
docker compose up --build -d
`

## Accessing the Application
- **Frontend**: http://localhost:3000
- **Backend API Docs**: http://localhost:8000/docs

## Project Structure
- Backend/: FastAPI application, statistical engines, SQLite database.
- rontend/: React single-page application.
- docs/: Extensive documentation (Docker, Setup, Status, etc).

## Configuration
See [docs/ENVIRONMENT.md](docs/ENVIRONMENT.md)

## Database
See [docs/DATABASE.md](docs/DATABASE.md)

## Development
See [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md)

## Troubleshooting
See [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md)

## Current Project Status
See [docs/PROJECT_STATUS.md](docs/PROJECT_STATUS.md)

## Known Limitations
- Does not currently support categorical factors in DoE properly.
- Missing %CV and Adequate Precision statistical metrics.
- Uses basic 2D SVG heatmaps rather than full WebGL 3D projections.
- SQLite limits concurrency.
- Missing 21 CFR Part 11 compliance (Audit Trails, RBAC).

## Roadmap
1. Complete statistical core (%CV, Adequate Precision).
2. Advanced WebGL plotting.
3. Migrate to PostgreSQL.
4. Add RBAC and Audit Trails.
