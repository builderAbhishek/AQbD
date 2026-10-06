.PHONY: up down build logs restart shell-backend shell-frontend db-migrate db-studio

up:
	docker compose up -d

down:
	docker compose down

build:
	docker compose up --build -d

logs:
	docker compose logs -f

restart:
	docker compose down
	docker compose up -d

shell-backend:
	docker compose exec backend sh

shell-frontend:
	docker compose exec frontend sh

db-migrate:
	docker compose exec backend npx prisma migrate dev --name init

db-studio:
	docker compose exec backend npx prisma studio
