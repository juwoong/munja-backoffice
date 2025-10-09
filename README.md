# Backoffice Docker 실행 가이드

프로젝트 전체를 Docker 환경에서 실행할 수 있도록 백엔드/프론트엔드용 Dockerfile과 `docker-compose.yml`이 추가되었습니다. 또한 개발 중 로컬에서 Postgres를 손쉽게 구동하기 위한 스크립트도 함께 제공합니다.

## 사전 준비

1. **환경 변수 설정**
   - `backend/.env.example`을 참고하여 `backend/.env` 파일을 생성합니다.
   - `JWT_SECRET`, RPC 관련 값, 컨트랙트 주소 등은 실제 환경에 맞게 수정합니다.

2. **의존성 설치**
   ```bash
   pnpm install
   ```

## Docker Compose 실행

```bash
docker compose up --build
```

- `db` 서비스가 먼저 올라가고, 건강 상태가 확인되면 `backend`가 Prisma 마이그레이션을 시도합니다.
- 마이그레이션 파일이 없을 경우 자동으로 `prisma db push`로 스키마를 반영한 뒤 서버를 시작합니다.
- 프론트엔드는 빌드 후 Nginx로 제공되며, 기본 포트는 `3000`입니다.

### 포트 정보

- Postgres: `localhost:5432`
- Backend API: `localhost:4000`
- Frontend: `localhost:3000`

## 로컬 개발용 데이터베이스 스크립트

`scripts` 디렉터리에 Postgres 컨테이너를 관리하는 스크립트를 제공합니다.

```bash
# Postgres 실행 (대기 포함)
./scripts/db-up.sh

# Postgres 중지
./scripts/db-down.sh
```

- `db-up.sh`는 `docker compose up -d db` 실행 후 `pg_isready`로 연결 가능 여부를 확인합니다.
- `db-down.sh`는 컨테이너만 중지하며, 볼륨을 삭제하지 않습니다. 필요 시 `docker compose rm -f db`로 정리할 수 있습니다.

## Prisma 관련 명령어

```bash
# Prisma Client 생성
pnpm --filter backend run prisma:generate

# 마이그레이션 실행 (배포)
pnpm --filter backend run prisma:migrate

# 스키마 강제 반영 (개발용)
pnpm --filter backend run prisma:push
```

Docker 빌드 과정에서는 `prisma:generate`가 자동으로 실행되며, 서버 시작 전에 `prisma:migrate` 또는 `prisma:push`가 실행됩니다.
