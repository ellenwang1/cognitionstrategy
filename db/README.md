# Database

Run `make db-up`, then `make migrate` and `make seed` from the repository root.
Alembic reads `DATABASE_URL` and defaults to the local Postgres instance from
`docker-compose.yml`. Migrations are intentionally split by platform and tool
so ownership stays clear.
