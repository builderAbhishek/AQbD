# Architecture

User Browser
     |
     v
Frontend Container (React, Vite, Tailwind) - Port 3000
     |
     v
Backend/API Container (FastAPI, Python) - Port 8000
     |
     +----> AQbD Statistical Engine (statsmodels, pyDOE3, scipy)
     |
     +----> Database (SQLite qbd.db)
     |
     v
Analysis Results (JSON & PDF)

## Components
- **Frontend**: React 18, Vite, React Router, TailwindCSS, TanStack Query.
- **Backend**: FastAPI, SQLAlchemy (ORM), Pydantic.
- **Statistical Engine**: statsmodels (ANOVA, Regression), pyDOE3 (CCD, BBD), scipy (Differential Evolution Optimization).
- **Database**: SQLite3 (qbd.db).
- **PDF Generation**: ReportLab.
