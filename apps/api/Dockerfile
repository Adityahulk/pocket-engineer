FROM node:22-bookworm-slim AS web

WORKDIR /web
ENV CI=1
ARG EXPO_PUBLIC_SUPABASE_URL=
ARG EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
ENV EXPO_PUBLIC_SUPABASE_URL=$EXPO_PUBLIC_SUPABASE_URL
ENV EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=$EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY
ENV EXPO_PUBLIC_API_URL=
COPY apps/mobile/package.json apps/mobile/package-lock.json ./
RUN npm ci
COPY apps/mobile ./
RUN npx expo export --platform web --output-dir dist

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
COPY --from=web /web/dist /app/web
ENV POCKET_WEB_ROOT=/app/web

EXPOSE 8000
CMD ["sh", "-c", "uv run uvicorn pocket_engineer.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
