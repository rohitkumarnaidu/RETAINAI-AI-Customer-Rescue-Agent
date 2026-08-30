.PHONY: help setup-backend setup-frontend dev backend frontend test seed lint clean

help:
	@echo "RETAINAI CLI Commands:"
	@echo "  setup-backend   - Sync backend dependencies with uv"
	@echo "  setup-frontend  - Install frontend dependencies with npm"
	@echo "  dev             - Run backend and frontend concurrently"
	@echo "  backend         - Run backend FastAPI server"
	@echo "  frontend        - Run frontend Vite dev server"
	@echo "  test            - Run backend pytest test suite"
	@echo "  seed            - Seed database with synthetic demo scenarios"
	@echo "  clean           - Remove virtualenv and build artifacts"

setup-backend:
	cd backend && uv sync

setup-frontend:
	cd frontend && npm install

dev:
	make -j 2 backend frontend

backend:
	cd backend && uv run uvicorn retainai.main:app --reload --port 8000

frontend:
	cd frontend && npm run dev

test:
	cd backend && uv run pytest

seed:
	cd backend && uv run python -m retainai.scripts.seed_database

clean:
	rm -rf backend/.venv frontend/node_modules frontend/dist backend/__pycache__

docker-up:
	docker compose up --build -d

docker-down:
	docker compose down -v

smoke:
	cd backend && uv run python -m retainai.scripts.seed_database
