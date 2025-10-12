# syntax=docker/dockerfile:1

FROM node:20-slim AS build

WORKDIR /app

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

RUN corepack enable

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY frontend/package.json frontend/package.json
COPY backend/package.json backend/package.json

RUN pnpm install --filter frontend... --frozen-lockfile

COPY frontend ./frontend

ARG VITE_API_URL="http://localhost:4000"
ENV VITE_API_URL=${VITE_API_URL}

RUN pnpm --filter frontend... run build

FROM nginx:1.27-alpine AS runner

COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/frontend/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
