# GitHub Actions Workflows

## 개요

백엔드와 프론트엔드 Docker 이미지를 빌드하고 GitHub Container Registry(GHCR)에 푸시하는 두 개의 독립적인 워크플로우가 있습니다.

- `backend.yml` - Backend 이미지 빌드
- `frontend.yml` - Frontend 이미지 빌드

## 설정 방법

### 1. GitHub Token 생성

1. GitHub Settings > Developer settings > Personal access tokens > Tokens (classic)
2. "Generate new token (classic)" 클릭
3. 다음 권한 선택:
   - `write:packages` - 패키지 업로드
   - `read:packages` - 패키지 읽기
   - `delete:packages` - 패키지 삭제 (선택사항)
4. 토큰 생성 후 복사

### 2. Repository Secret 설정

1. Repository > Settings > Secrets and variables > Actions
2. "New repository secret" 클릭
3. Name: `GHCR_TOKEN`
4. Value: 위에서 생성한 토큰 붙여넣기
5. "Add secret" 클릭

### 3. Frontend 런타임 환경변수 (선택사항)

**중요**: Frontend 이미지는 빌드 시점이 아닌 **런타임에** 환경변수를 주입합니다.
따라서 하나의 이미지를 여러 환경에서 재사용할 수 있습니다.

Repository Variables 설정은 **필요 없습니다**. 대신 Docker 실행 시 환경변수를 전달하세요.

## Backend Workflow (`backend.yml`)

### 트리거 조건

다음 파일이 변경될 때만 실행됩니다:
- `backend/**` - 백엔드 소스 코드
- `prisma/**` - Prisma 스키마 및 마이그레이션
- `pnpm-lock.yaml` - 의존성 잠금 파일
- `pnpm-workspace.yaml` - Workspace 설정
- `package.json` - 루트 패키지 설정
- `.github/workflows/backend.yml` - 워크플로우 파일

### 이미지 주소

`ghcr.io/juwoong/munja-backoffice-backend:latest`

### 태그

- `latest` - main 브랜치의 최신 이미지
- `main`, `develop` - 브랜치 이름
- `main-abc1234` - 브랜치명 + 커밋 SHA
- `pr-123` - PR 번호

## Frontend Workflow (`frontend.yml`)

### 트리거 조건

다음 파일이 변경될 때만 실행됩니다:
- `frontend/**` - 프론트엔드 소스 코드
- `pnpm-lock.yaml` - 의존성 잠금 파일
- `pnpm-workspace.yaml` - Workspace 설정
- `package.json` - 루트 패키지 설정
- `.github/workflows/frontend.yml` - 워크플로우 파일

### 이미지 주소

`ghcr.io/juwoong/munja-backoffice-frontend:latest`

### 태그

- `latest` - main 브랜치의 최신 이미지
- `main`, `develop` - 브랜치 이름
- `main-abc1234` - 브랜치명 + 커밋 SHA
- `pr-123` - PR 번호

## 빌드 예시

| 변경된 파일 | Backend 빌드 | Frontend 빌드 |
|------------|-------------|--------------|
| `backend/src/index.ts` | ✅ | ⏭️ |
| `frontend/src/App.tsx` | ⏭️ | ✅ |
| `pnpm-lock.yaml` | ✅ | ✅ |
| `prisma/schema.prisma` | ✅ | ⏭️ |
| `README.md` | ⏭️ | ⏭️ |
| `backend/` + `frontend/` | ✅ | ✅ |

## 캐싱

각 워크플로우는 독립적인 GitHub Actions 캐시를 사용합니다:

- Backend: `cache-scope=backend`
- Frontend: `cache-scope=frontend`
- Docker 레이어 캐싱으로 빌드 시간 단축
- 이전 빌드의 레이어를 재사용

## 수동 실행

Actions 탭에서 원하는 워크플로우를 선택하고 "Run workflow" 버튼으로 수동 실행 가능합니다.

## 이미지 사용 방법

### Backend 이미지

```bash
# Pull
docker pull ghcr.io/juwoong/munja-backoffice-backend:latest

# Run
docker run -d \
  -p 4000:4000 \
  -e DATABASE_URL="postgresql://..." \
  -e JWT_SECRET="your-secret" \
  -e VALIDATOR_OPERATOR_ADDRESS="..." \
  --name backend \
  ghcr.io/juwoong/munja-backoffice-backend:latest
```

### Frontend 이미지

```bash
# Pull
docker pull ghcr.io/juwoong/munja-backoffice-frontend:latest

# Run with runtime environment variable
docker run -d \
  -p 80:80 \
  -e VITE_API_URL="https://api.your-domain.com" \
  --name frontend \
  ghcr.io/juwoong/munja-backoffice-frontend:latest

# 환경변수를 지정하지 않으면 기본값 http://localhost:4000 사용
```

### Docker Compose

```yaml
version: '3.8'

services:
  backend:
    image: ghcr.io/juwoong/munja-backoffice-backend:latest
    ports:
      - "4000:4000"
    environment:
      - DATABASE_URL=postgresql://user:pass@db:5432/backoffice
      - JWT_SECRET=your-secret-key
      - VALIDATOR_OPERATOR_ADDRESS=mito1...

  frontend:
    image: ghcr.io/juwoong/munja-backoffice-frontend:latest
    ports:
      - "80:80"
    environment:
      - VITE_API_URL=http://backend:4000  # Runtime 환경변수
    depends_on:
      - backend
```

### 런타임 환경변수 재사용 (Frontend)

Frontend 이미지는 빌드 타임이 아닌 **런타임에** 환경변수를 주입하므로, 하나의 이미지를 여러 환경에서 재사용할 수 있습니다:

```bash
# 개발 환경
docker run -d -p 80:80 \
  -e VITE_API_URL="http://localhost:4000" \
  ghcr.io/juwoong/munja-backoffice-frontend:latest

# 스테이징 환경
docker run -d -p 80:80 \
  -e VITE_API_URL="https://staging-api.example.com" \
  ghcr.io/juwoong/munja-backoffice-frontend:latest

# 프로덕션 환경
docker run -d -p 80:80 \
  -e VITE_API_URL="https://api.example.com" \
  ghcr.io/juwoong/munja-backoffice-frontend:latest
```

동일한 이미지(`latest`)를 사용하면서 환경변수만 변경하여 다른 환경에 배포할 수 있습니다.

## 문제 해결

### 인증 오류

```
Error: failed to authorize: failed to fetch anonymous token
```

**해결방법**:
1. GHCR_TOKEN이 올바르게 설정되었는지 확인
2. 토큰에 `write:packages` 권한이 있는지 확인
3. 토큰이 만료되지 않았는지 확인

### 이미지 접근 권한 오류

이미지를 pull할 때 권한 오류가 발생하면:

1. Repository를 public으로 설정하거나
2. GitHub 토큰으로 로그인:
   ```bash
   echo $GHCR_TOKEN | docker login ghcr.io -u USERNAME --password-stdin
   ```

### 워크플로우가 실행되지 않음

- 변경한 파일이 `paths` 필터에 포함되어 있는지 확인
- `main` 또는 `develop` 브랜치에 push했는지 확인
- Actions 탭에서 워크플로우가 비활성화되지 않았는지 확인

## 플랫폼

현재 `linux/amd64` 플랫폼만 빌드합니다. ARM 플랫폼(Apple Silicon 등)이 필요한 경우 워크플로우 파일을 수정하세요:

```yaml
platforms: linux/amd64,linux/arm64
```

단, 빌드 시간이 2-3배 증가할 수 있습니다.
