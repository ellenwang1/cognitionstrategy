PYTHON ?= .venv/bin/python
ALEMBIC ?= .venv/bin/alembic

.PHONY: venv db-up migrate seed demo-reset api schema test lint

venv:
	python3 -m venv .venv
	$(PYTHON) -m pip install -r requirements-dev.txt

db-up:
	docker compose up -d postgres

migrate:
	cd db && ../$(ALEMBIC) upgrade head

seed:
	PYTHONPATH=. $(PYTHON) db/seed.py

demo-reset:
	PYTHONPATH=. $(PYTHON) scripts/demo_reset.py

api:
	./scripts/run_services.sh

schema:
	$(PYTHON) scripts/export_config_schema.py

test:
	$(PYTHON) -m pytest

lint:
	$(PYTHON) -m ruff check platform services db
