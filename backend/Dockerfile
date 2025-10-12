# syntax=docker/dockerfile:1

FROM node:20-slim

WORKDIR /app

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

RUN corepack enable

RUN apt-get update -y \
  && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY backend/package.json backend/package.json
COPY frontend/package.json frontend/package.json

RUN pnpm install --filter backend... --frozen-lockfile

COPY backend ./backend

RUN pnpm --filter backend... run prisma:generate

RUN pnpm --filter backend... run build

EXPOSE 4000

CMD ["pnpm", "--filter", "backend", "run", "start"]
