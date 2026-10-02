# Troubleshooting

## Frontend Not Updating
Check if Vite polling is working. Ensure CHOKIDAR_USEPOLLING=true is in your environment if you are on Windows/WSL.

## Database Locked Error
SQLite only supports a single writer. If you see database is locked, wait a moment and try again. For production, migrate to PostgreSQL.

## Missing node_modules error
If Vite fails to start, ensure the /app/node_modules anonymous volume is working, or rebuild the frontend container:
docker compose up --build frontend
