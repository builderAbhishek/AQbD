# Environment Configuration

Copy .env.example to .env to configure your environment.

## Variables
- DATABASE_URL: The SQLAlchemy connection string. Defaults to sqlite:///./aqbd.db.
- VITE_API_URL: The URL where the frontend expects the backend. Defaults to http://localhost:8000.

**SECURITY WARNING**: Never commit .env containing production passwords, secret keys, or real tokens.
