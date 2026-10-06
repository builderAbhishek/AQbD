# AQbD Studio

AQbD Studio is a web application foundation for Analytical Quality by Design (AQbD).

## Current Phase (Phase 1)
This phase only implements:
- Docker development environment
- PostgreSQL Database
- Dashboard
- Project management (New, Open, Save, Save As, Import, Export, Delete)
- Application shell and routing

**Not implemented yet (Coming in V1):**
- CCD, BBD, RSM
- Regression, ANOVA, Diagnostics
- Model Graphs, Optimization, Prediction, Confirmation, Reporting

## Architecture
- **Frontend**: React, Vite, TypeScript, TailwindCSS
- **Backend**: Node.js, Express, TypeScript, Prisma ORM
- **Database**: PostgreSQL
- **Environment**: Docker + Docker Compose

## Requirements
- Docker and Docker Compose

## Docker Setup & Commands
The entire development environment runs in Docker.

- **Start application in background**: `docker compose up -d`
- **Build and start**: `docker compose up --build -d`
- **Stop application**: `docker compose down`
- **View logs**: `docker compose logs -f`
- **View status**: `docker compose ps`

Alternatively, use the Makefile shortcuts:
- `make up`
- `make down`
- `make build`
- `make logs`
- `make restart`

## Environment Setup
Copy `.env.example` to `.env` and configure variables.

## Project Structure
- `/frontend`: React frontend
- `/backend`: Express backend API
- `/docs`: Documentation
- `docker-compose.yml`: Docker configuration

## API Overview
- `GET /api/v1/health`: Health check
- `GET /api/v1/projects`: List projects
- `POST /api/v1/projects`: Create project
- `GET /api/v1/projects/:id`: Get project
- `PUT /api/v1/projects/:id`: Update project
- `DELETE /api/v1/projects/:id`: Delete project
- `POST /api/v1/projects/:id/duplicate`: Duplicate project
- `PUT /api/v1/projects/:id/archive`: Archive project
- `GET /api/v1/projects/:id/export`: Export project as JSON
- `POST /api/v1/projects/import`: Import project from JSON

## Database Overview
Uses PostgreSQL with Prisma ORM. Main tables:
- `Project`: Core project metadata and state.
