# Development Guide

## Live Reloading
Both the backend and frontend use Docker volumes to map your local files into the containers. 
- Backend uses uvicorn --reload.
- Frontend uses ite with polling enabled (CHOKIDAR_USEPOLLING=true).

Simply save your files, and the containers will automatically reflect the changes.

## Running Tests
Run pytest in the backend container:
docker compose exec backend pytest
