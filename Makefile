.PHONY: setup api mobile test lint sandbox-image

setup:
	cd apps/api && uv sync --extra dev
	cd apps/mobile && npm install

api:
	cd apps/api && uv run uvicorn pocket_engineer.main:app --reload --host 0.0.0.0 --port 8000

mobile:
	cd apps/mobile && npm start

test:
	cd apps/api && uv run pytest
	cd apps/mobile && npm run typecheck
	cd apps/mobile && npm run lint

sandbox-image:
	docker build -t pocket-engineer-sandbox:latest -f images/sandbox/Dockerfile .

