# Database

This project currently uses **SQLite**.

The database file is stored at ackend/aqbd.db.
A test database is stored at ackend/test.db.

## Persisting Data
The SQLite file is mapped directly to your local file system via Docker volumes (./backend:/app). This means data is persisted across container restarts automatically.

## Migrations
SQLAlchemy models define the schema. The application uses Base.metadata.create_all(bind=engine) on startup to ensure tables exist.
