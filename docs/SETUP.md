# Setup

## Prerequisites
- Git
- Docker Desktop

## Steps
1. Clone the repository: git clone <repo_url>
2. Enter the directory: cd AQbD
3. Copy environment file: cp .env.example .env
4. Start Docker containers: docker compose up --build
5. Open the frontend at http://localhost:3000
6. View the backend API docs at http://localhost:8000/docs
"@
Set-Content -Path docs/DOCKER.md -Value @"
# Docker

## Commands
- **Build & Start**: docker compose up --build -d
- **Start (No Build)**: docker compose up -d
- **Stop**: docker compose down
- **Restart**: docker compose restart
- **View Logs**: docker compose logs -f

## Volumes
- ./backend:/app - Live reloads backend code.
- ./frontend:/app - Live reloads frontend code.
- /app/node_modules - Prevents local node_modules from overwriting container's Linux node_modules.

## Ports
- **Frontend**: 3000
- **Backend**: 8000
