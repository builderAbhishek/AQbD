# AQbD SOFTWARE V1
**Analytical Quality by Design (AQbD) / Design of Experiments (DOE) Software**

## Project Overview
Research-grade AQbD workflow software for analytical procedure development. Provides a structured workflow for developing and optimizing analytical procedures using AQbD principles and Design of Experiments (DOE).

## Architecture & Tech Stack
- **Frontend**: React, TypeScript, Tailwind CSS, Plotly.js, TanStack Query, React Hook Form
- **Backend**: Python, FastAPI, Pydantic, Pandas, NumPy, SciPy, Statsmodels, PyDOE3
- **Database**: SQLite (V1 Development), PostgreSQL (V1 Production/Future)
- **Deployment**: Docker, Docker Compose

## Installation & Running Locally (Docker Compose)
The recommended way to run this locally for V1 is via Docker Compose.

1. Ensure Docker and Docker Compose are installed.
2. In the root directory, run:
   ```bash
   docker compose up --build
   ```
3. **Frontend**: Access the application at `http://localhost:3000`
4. **Backend API**: Access the Swagger UI at `http://localhost:8000/docs`

## Manual Installation
### Running Backend
1. Navigate to the `backend` directory.
2. Create a virtual environment: `python -m venv venv`
3. Activate the virtual environment.
4. Install dependencies: `pip install -r requirements.txt`
5. Run the server: `uvicorn main:app --reload`

### Running Frontend
1. Navigate to the `frontend` directory.
2. Install dependencies: `npm install`
3. Run the development server: `npm run dev`

## Environment Variables
- `DATABASE_URL`: Connection string for the database (default: `sqlite:///./aqbd.db` in local mode).
- `VITE_API_URL`: URL of the backend API for the frontend to connect to (default: `http://localhost:8000`).

## Phase 2 Modules & API
- **ATP**: Analytical Target Profile definitions (`/api/v1/atp` and `/api/v1/projects/{id}/atp`)
- **Risk Assessment**: Parameter risk scores (`/api/v1/risk` and `/api/v1/projects/{id}/risk`). 
  > *Note: RPN (Risk Priority Number = Severity × Occurrence × Detectability) is used here as a configurable risk-management mechanism, not an ICH-required formula.*
- **Factors**: Experimental input variables (`/api/v1/factors` and `/api/v1/projects/{id}/factors`)
- **Responses**: Measured output variables (`/api/v1/responses` and `/api/v1/projects/{id}/responses`)

## Engine Details
- **Statistical Engine**: Built on `statsmodels` (OLS regression, ANOVA), `scipy` (diagnostics), and `numpy` (matrix operations).
- **DOE Engine**: Built on `pyDOE3` (Box-Behnken, Central Composite, Factorials) with internal validation layers.

## Known Limitations (V1)
- Advanced block designs are not supported in V1.
- Regulatory electronic signature / Part 11 compliance is out of scope.
- Machine learning, neural networks, or PLS/PCR multivariate spectroscopy are not included in this release.
- Extrapolation outside the experimental region during optimization is blocked by default without a warning override.
