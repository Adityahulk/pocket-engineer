FROM node:22-bookworm-slim AS node-runtime

FROM ghcr.io/astral-sh/uv:python3.12-bookworm-slim

ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /app/apps/api

RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates git ripgrep \
    && rm -rf /var/lib/apt/lists/*

COPY --from=node-runtime /usr/local/bin/node /usr/local/bin/node
COPY --from=node-runtime /usr/local/lib/node_modules /usr/local/lib/node_modules
RUN ln -s /usr/local/lib/node_modules/npm/bin/npm-cli.js /usr/local/bin/npm \
    && ln -s /usr/local/lib/node_modules/npm/bin/npx-cli.js /usr/local/bin/npx

COPY apps/api/pyproject.toml apps/api/uv.lock ./
RUN uv sync --frozen --extra agent --extra dev
COPY apps/api/src ./src
COPY fixtures /app/fixtures

EXPOSE 8000
CMD ["sh", "-c", "uv run uvicorn pocket_engineer.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
