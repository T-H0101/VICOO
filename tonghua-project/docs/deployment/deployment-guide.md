# Tonghua Public Welfare — Deployment Guide

> 童画公益 x 可持续时尚 平台部署文档

## Table of Contents

- [Prerequisites](#prerequisites)
- [Local Development Setup](#local-development-setup)
- [Docker Compose Deployment](#docker-compose-deployment)
- [Environment Variables Reference](#environment-variables-reference)
- [CI/CD Pipeline Walkthrough](#cicd-pipeline-walkthrough)
- [Production Deployment Checklist](#production-deployment-checklist)
- [Monitoring and Logging](#monitoring-and-logging)
- [Backup and Recovery](#backup-and-recovery)
- [Troubleshooting](#troubleshooting)
- [Security Hardening](#security-hardening)

---

## Prerequisites

### Required Software

| Software     | Version  | Purpose                     | Installation                            |
|-------------|----------|-----------------------------|-----------------------------------------|
| Docker      | 24+      | Container runtime           | [docs.docker.com/get-docker](https://docs.docker.com/get-docker/) |
| Docker Compose | v2.20+ | Multi-container orchestration | Included with Docker Desktop            |
| Node.js     | 18 LTS   | Frontend build toolchain    | [nodejs.org](https://nodejs.org/)       |
| Python      | 3.11+    | Backend runtime             | [python.org](https://www.python.org/)   |
| Git         | 2.40+    | Version control             | [git-scm.com](https://git-scm.com/)     |

### Optional Tools

| Tool          | Purpose                              |
|---------------|--------------------------------------|
| MySQL Client  | Database inspection and debugging    |
| Redis CLI     | Cache inspection                     |
| RabbitMQ Management UI | Queue monitoring (port 15672) |
| curl / HTTPie | API endpoint testing                 |

### System Requirements

- **Development**: 8 GB RAM, 20 GB disk space
- **Staging/Production**: 16 GB RAM, 50 GB disk space, 4 CPU cores

---

## Local Development Setup

### Step 1: Clone the Repository

```bash
git clone https://github.com/<your-org>/tonghua-project.git
cd tonghua-project
```

### Step 2: Configure Environment Variables

```bash
cd deploy/docker
cp .env.example .env
```

**Critical Security Note**: As of the security update, `docker-compose.yml` no longer contains any default secrets. All environment variables must be explicitly set in your `.env` file. Docker Compose will fail to start if any required secret is missing.

The following values must be set for local development:

```dotenv
# Required secrets - no defaults allowed
MYSQL_ROOT_PASSWORD=<secure-password>
MYSQL_PASSWORD=<secure-password>
REDIS_PASSWORD=<secure-password>
RABBITMQ_PASSWORD=<secure-password>
APP_SECRET_KEY=<generate-a-random-string>
JWT_SECRET_KEY=<generate-a-random-string>
ENCRYPTION_KEY=<64-char-hex-string>
CHILD_DATA_ENCRYPTION_KEY=<64-char-hex-string>

# Optional but recommended
MYSQL_USER=tonghua
MYSQL_DATABASE=tonghua_db
RABBITMQ_USER=tonghua
```

Generate secure random values:

```bash
# APP_SECRET_KEY
openssl rand -hex 32

# ENCRYPTION_KEY (AES-256 requires 64 hex chars = 32 bytes)
openssl rand -hex 32
```

### Step 3: Start All Services with Docker Compose

```bash
cd deploy/docker
docker compose up -d
```

This starts the full stack:

| Service    | Container           | Port  | Access                                |
|-----------|---------------------|-------|---------------------------------------|
| MySQL 8.0 | tonghua-mysql       | 3306  | `mysql -h localhost -u tonghua -p`    |
| Redis 7   | tonghua-redis       | 6379  | `redis-cli -h localhost -a <pass>`    |
| RabbitMQ  | tonghua-rabbitmq    | 5672  | Management UI: `http://localhost:15672` |
| Backend   | tonghua-backend     | 8000  | API: `http://localhost:8000`          |
| Frontend  | tonghua-frontend    | 80    | App: `http://localhost`               |

### Step 4: Initialize the Database

The MySQL container automatically runs SQL scripts placed in `deploy/docker/init-db/`. Place your schema migration files there:

```bash
# Example: init-db/01-schema.sql will run on first container startup
deploy/docker/init-db/
  01-schema.sql
  02-seed-data.sql
```

To manually run migrations after the initial startup:

```bash
docker exec -i tonghua-mysql mysql -u tonghua -p tonghua_db < path/to/migration.sql
```

### Step 5: Verify Services

```bash
# Check all containers are running
docker compose ps

# Check backend health
curl http://localhost:8000/health

# Check frontend
curl -I http://localhost

# Check backend logs
docker compose logs backend -f
```

### Step 6: Run Frontend in Development Mode (Optional)

If you want hot-reload during frontend development, run the React dev server outside Docker:

```bash
cd frontend/web-react
npm install
npm run dev
```

The dev server starts at `http://localhost:5173` and proxies API requests to the Docker backend on port 8000.

### Step 7: Run Backend Locally (Optional)

```bash
cd backend
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r requirements.txt

# Set environment variables (or use a .env file)
export DATABASE_URL="mysql+aiomysql://tonghua:tonghua_dev_pass@localhost:3306/tonghua_db"
export REDIS_URL="redis://:tonghua_redis_pass@localhost:6379/0"

# Run with auto-reload
uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000
```

---

## Docker Compose Deployment

### Architecture Overview

```
                    Internet
                       |
                  [Nginx :80]
                    /      \
     React SPA (static)   /api/* proxy
                          |
                   [FastAPI :8000]
                    /     |      \
               MySQL    Redis   RabbitMQ
              :3306     :6379    :5672
```

### Service Details

#### MySQL 8.0

- Charset: `utf8mb4` with `utf8mb4_unicode_ci` collation
- Connection pool: max 200 connections
- InnoDB buffer pool: 256 MB
- Data persisted to Docker volume `mysql_data`
- Init scripts run from `deploy/docker/init-db/` on first start only

#### Redis 7 (Alpine)

- AOF persistence enabled
- Max memory: 128 MB with LRU eviction
- Password-protected

#### RabbitMQ 3.12 (Alpine + Management)

- Management UI on port 15672
- Default vhost: `/`
- Data persisted to Docker volume `rabbitmq_data`

#### Backend (FastAPI)

- Multi-stage Docker build (Python 3.11-slim)
- Runs as non-root user `tonghua`
- 4 uvicorn worker processes
- Health check endpoint: `/health`

#### Frontend (React + Nginx)

- Multi-stage build (Node 18 build, Nginx Alpine serve)
- Gzip compression enabled
- Static assets cached with immutable headers (1 year)
- API proxy to backend via `/api/` path
- WebSocket support via `/ws/` path
- SPA fallback routing via `try_files`
- Security headers: CSP, X-Frame-Options, X-Content-Type-Options

### Useful Commands

```bash
# Start services
docker compose up -d

# Stop services (preserves data volumes)
docker compose down

# Stop and remove volumes (full reset)
docker compose down -v

# Rebuild a specific service
docker compose build backend
docker compose up -d backend

# View logs
docker compose logs -f --tail=100 backend

# Scale backend workers (for load testing)
docker compose up -d --scale backend=3

# Enter a running container
docker exec -it tonghua-backend /bin/bash
docker exec -it tonghua-mysql mysql -u tonghua -p tonghua_db
```

---

## Environment Variables Reference

All variables are defined in `deploy/docker/.env.example`. Copy to `.env` and customize.

### Application

| Variable | Default | Description |
|----------|---------|-------------|
| `APP_NAME` | `tonghua-public-welfare` | Application identifier |
| `APP_ENV` | `development` | Environment: `development`, `staging`, `production` |
| `APP_DEBUG` | `true` | Enable debug mode (disable in production) |
| `APP_SECRET_KEY` | `change-me` | Application secret for signing (generate with `openssl rand -hex 32`) |
| `APP_PORT` | `8000` | Backend listen port |

### Database (MySQL)

| Variable | Default | Description |
|----------|---------|-------------|
| `MYSQL_HOST` | `mysql` | Database hostname (Docker service name) |
| `MYSQL_PORT` | `3306` | Database port |
| `MYSQL_USER` | `tonghua` | Database user |
| `MYSQL_PASSWORD` | `change-me` | Database password |
| `MYSQL_DATABASE` | `tonghua_db` | Database name |
| `DATABASE_URL` | (composed) | Full SQLAlchemy connection URL |

### Redis

| Variable | Default | Description |
|----------|---------|-------------|
| `REDIS_HOST` | `redis` | Redis hostname |
| `REDIS_PORT` | `6379` | Redis port |
| `REDIS_PASSWORD` | `change-me` | Redis password |
| `REDIS_DB` | `0` | Redis database index |
| `REDIS_URL` | (composed) | Full Redis connection URL |

### RabbitMQ

| Variable | Default | Description |
|----------|---------|-------------|
| `RABBITMQ_HOST` | `rabbitmq` | RabbitMQ hostname |
| `RABBITMQ_PORT` | `5672` | RabbitMQ AMQP port |
| `RABBITMQ_USER` | `tonghua` | RabbitMQ user |
| `RABBITMQ_PASSWORD` | `change-me` | RabbitMQ password |
| `RABBITMQ_URL` | (composed) | Full AMQP connection URL |

### JWT Authentication

| Variable | Default | Description |
|----------|---------|-------------|
| `JWT_SECRET_KEY` | `change-me` | JWT signing key (use RSA keys in production) |
| `JWT_PUBLIC_KEY` | `change-me` | JWT verification key (for RS256) |
| `JWT_ALGORITHM` | `RS256` | Signing algorithm: `HS256` (dev), `RS256` (prod) |
| `JWT_ACCESS_TOKEN_EXPIRE_MINUTES` | `15` | Access token lifetime |
| `JWT_REFRESH_TOKEN_EXPIRE_DAYS` | `7` | Refresh token lifetime |

### Encryption

| Variable | Default | Description |
|----------|---------|-------------|
| `ENCRYPTION_KEY` | `change-me` | AES-256-GCM key (64 hex chars) for general data |
| `CHILD_DATA_ENCRYPTION_KEY` | `change-me` | Separate AES-256-GCM key for children's PII |

### Payment Gateways

| Variable | Description |
|----------|-------------|
| `WECHAT_PAY_MCH_ID` | WeChat Pay merchant ID |
| `WECHAT_PAY_API_KEY` | WeChat Pay API key |
| `WECHAT_APP_ID` / `WECHAT_APP_SECRET` | WeChat application credentials |
| `ALIPAY_APP_ID` / `ALIPAY_PRIVATE_KEY` / `ALIPAY_PUBLIC_KEY` | Alipay credentials |
| `STRIPE_SECRET_KEY` / `STRIPE_PUBLISHABLE_KEY` | Stripe API keys |
| `PAYPAL_CLIENT_ID` / `PAYPAL_CLIENT_SECRET` | PayPal API credentials |

### Object Storage

| Variable | Description |
|----------|-------------|
| `OSS_ENDPOINT` | Alibaba Cloud OSS endpoint |
| `OSS_ACCESS_KEY_ID` / `OSS_ACCESS_KEY_SECRET` | OSS credentials |
| `OSS_BUCKET_NAME` | OSS bucket name |
| `OSS_CDN_DOMAIN` | CDN domain for asset delivery |

### Rate Limiting

| Variable | Default | Description |
|----------|---------|-------------|
| `RATE_LIMIT_GLOBAL_PER_SECOND` | `1000` | Global requests per second |
| `RATE_LIMIT_USER_PER_MINUTE` | `60` | Per-user requests per minute |
| `RATE_LIMIT_IP_PER_SECOND` | `20` | Per-IP requests per second |

---

## CI/CD Pipeline Walkthrough

The CI/CD pipeline is defined in `deploy/ci/github-actions.yml` and runs on GitHub Actions.

### Trigger Conditions

- **Push** to `main` or `develop` branches
- **Pull requests** targeting `main`

### Pipeline Stages

```
Push to main/develop
  |
  +-- Backend Lint & Type Check
  |     |-> ruff (linting)
  |     |-> mypy (type checking)
  |
  +-- Frontend Lint & Type Check
  |     |-> tsc --noEmit (TypeScript)
  |     |-> npm run lint (ESLint)
  |
  +-- Backend Tests (depends on backend-lint)
  |     |-> MySQL 8.0 service container
  |     |-> Redis 7 service container
  |     |-> pytest tests/ -v
  |
  +-- Frontend Tests (depends on frontend-lint)
  |     |-> npm test
  |
  +-- Backend Docker Build (depends on backend-test, main only)
  |     |-> Build backend.Dockerfile
  |     |-> Push to ghcr.io/<repo>/backend:latest + :<sha>
  |
  +-- Frontend Docker Build (depends on frontend-test, main only)
  |     |-> Build frontend.Dockerfile
  |     |-> Push to ghcr.io/<repo>/frontend:latest + :<sha>
  |
  +-- Deploy to Staging (depends on both builds, main only)
  |     |-> Pull images and restart on staging server
  |
  +-- Deploy to Production (depends on staging, main only)
        |-> Manual approval required
        |-> Pull images and restart on production server
```

### Container Registry

Images are pushed to GitHub Container Registry (ghcr.io):

```
ghcr.io/<org>/tonghua-project/backend:latest
ghcr.io/<org>/tonghua-project/backend:<commit-sha>
ghcr.io/<org>/tonghua-project/frontend:latest
ghcr.io/<org>/tonghua-project/frontend:<commit-sha>
```

### Required GitHub Secrets

| Secret | Description |
|--------|-------------|
| `STAGING_HOST` | Staging server SSH address |
| `PROD_HOST` | Production server SSH address |
| `GITHUB_TOKEN` | Auto-provided for GHCR authentication |

### Branch Strategy

- `develop` -- CI runs lint and tests only (no builds or deploys)
- `main` -- Full pipeline: lint, test, build, deploy to staging, then production with manual approval

---

## Production Deployment Checklist

### Pre-Deployment

- [ ] All CI pipeline checks pass on `main`
- [ ] Staging environment tested and verified
- [ ] Database migrations reviewed and tested
- [ ] Environment variables set for production (see below)
- [ ] SSL/TLS certificates obtained and configured
- [ ] DNS records configured for the production domain

### Environment Configuration

- [ ] `APP_ENV=production`
- [ ] `APP_DEBUG=false`
- [ ] `APP_SECRET_KEY` -- unique, 64-char hex, stored in secrets manager
- [ ] `JWT_ALGORITHM=RS256` with proper RSA key pair
- [ ] `ENCRYPTION_KEY` and `CHILD_DATA_ENCRYPTION_KEY` -- unique, generated, stored in secrets manager
- [ ] All `change-me` values replaced with real credentials
- [ ] `CORS_ORIGINS` set to production domain only
- [ ] Payment gateway keys switched from sandbox/test to live
- [ ] `RATE_LIMIT_*` values tuned for expected traffic

### Infrastructure

- [ ] Server provisioned with adequate resources (16 GB RAM, 4 CPU, 50 GB disk)
- [ ] Docker and Docker Compose installed
- [ ] Firewall configured (allow 80, 443; block 3306, 6379, 5672 from public)
- [ ] TLS termination configured (via Nginx with Let's Encrypt or load balancer)
- [ ] Automated backups scheduled
- [ ] Log aggregation configured
- [ ] Monitoring and alerting set up

### Security

- [ ] Secrets never committed to Git
- [ ] Docker images scanned for vulnerabilities
- [ ] Non-root containers confirmed
- [ ] Database access restricted to application network only
- [ ] Redis bound to internal network only
- [ ] RabbitMQ management UI not exposed publicly
- [ ] Rate limiting verified under load
- [ ] Children's data encryption verified
- [ ] Privacy policy and legal compliance pages deployed

### Post-Deployment

- [ ] Health checks passing for all services
- [ ] Smoke test: create user, browse campaigns, submit artwork
- [ ] Payment flow tested in sandbox mode first
- [ ] Error monitoring (Sentry or equivalent) receiving events
- [ ] Backup restore tested at least once
- [ ] Rollback procedure documented and tested

---

## Monitoring and Logging

### Health Checks

Every service has a Docker-level health check:

| Service | Health Check Command | Interval |
|---------|---------------------|----------|
| MySQL | `mysqladmin ping` | 10s |
| Redis | `redis-cli ping` | 10s |
| RabbitMQ | `rabbitmq-diagnostics check_running` | 15s |
| Backend | `GET /health` via Python urllib | 15s |
| Frontend | `wget --spider http://localhost:80` | 15s |

### Application Logging

The backend (FastAPI/uvicorn) outputs structured logs to stdout. Docker captures these automatically:

```bash
# View real-time logs
docker compose logs -f backend

# View last 500 lines
docker compose logs --tail=500 backend

# Filter by time
docker compose logs --since="2026-03-01T00:00:00" backend
```

### Nginx Access and Error Logs

Nginx writes logs inside the container:

- Access log: `/var/log/nginx/access.log`
- Error log: `/var/log/nginx/error.log`

To access them:

```bash
docker exec tonghua-frontend cat /var/log/nginx/access.log
docker exec tonghua-frontend cat /var/log/nginx/error.log
```

### Recommended Monitoring Stack

For production, consider adding:

1. **Prometheus + Grafana** -- metrics and dashboards
2. **Loki + Promtail** -- log aggregation
3. **Sentry** -- application error tracking
4. **Uptime Kuma** or similar -- external uptime monitoring

---

## Backup and Recovery

### MySQL Backup

```bash
# Create a backup
docker exec tonghua-mysql mysqldump \
  -u tonghua -p \
  --single-transaction \
  --routines \
  --triggers \
  tonghua_db > backup_$(date +%Y%m%d_%H%M%S).sql

# Automated daily backup (add to crontab)
0 2 * * * docker exec tonghua-mysql mysqldump -u tonghua -pYOUR_PASS --single-transaction tonghua_db | gzip > /backups/tonghua_$(date +\%Y\%m\%d).sql.gz
```

### MySQL Restore

```bash
# Restore from backup
docker exec -i tonghua-mysql mysql -u tonghua -p tonghua_db < backup_20260319_120000.sql

# Restore from compressed backup
gunzip -c backup_20260319_120000.sql.gz | docker exec -i tonghua-mysql mysql -u tonghua -p tonghua_db
```

### Redis Backup

Redis AOF persistence is enabled. The AOF file is stored in the `redis_data` volume.

```bash
# Trigger a manual save
docker exec tonghua-redis redis-cli -a ${REDIS_PASSWORD} BGSAVE

# Copy the dump file out
docker cp tonghua-redis:/data/dump.rdb ./redis_backup_$(date +%Y%m%d).rdb
```

### Volume Backup

```bash
# Backup all volumes
docker run --rm -v tonghua-project_mysql_data:/data -v $(pwd):/backup alpine \
  tar czf /backup/mysql_data_$(date +%Y%m%d).tar.gz -C /data .
```

### Full Disaster Recovery

1. Provision a new server with Docker and Docker Compose
2. Clone the repository
3. Restore the `.env` file from your secrets manager
4. Start MySQL only: `docker compose up -d mysql`
5. Wait for MySQL to be healthy, then restore the database dump
6. Start all services: `docker compose up -d`
7. Verify health checks and run smoke tests

---

## Troubleshooting

### Service Won't Start

```bash
# Check container status and exit codes
docker compose ps

# View detailed logs
docker compose logs <service-name> --tail=50

# Common cause: port conflict
# Check if ports are already in use
netstat -tlnp | grep -E '80|3306|6379|5672|8000'
```

### Backend Cannot Connect to MySQL

```
sqlalchemy.exc.OperationalError: (2003, "Can't connect to MySQL server")
```

**Solutions:**

1. Ensure MySQL container is healthy: `docker compose ps mysql`
2. Check MySQL logs: `docker compose logs mysql`
3. Verify `DATABASE_URL` uses the Docker service name (`mysql`), not `localhost`
4. Wait for the health check to pass -- the backend depends on `service_healthy`

### Backend Cannot Connect to Redis

```
redis.exceptions.ConnectionError: Error connecting to Redis
```

**Solutions:**

1. Check Redis is running: `docker compose ps redis`
2. Verify `REDIS_URL` includes the password: `redis://:<password>@redis:6379/0`
3. Check Redis logs: `docker compose logs redis`

### Frontend Shows 502 Bad Gateway

The Nginx frontend proxy cannot reach the backend.

**Solutions:**

1. Check backend is running and healthy: `docker compose ps backend`
2. Test backend directly: `curl http://localhost:8000/health`
3. Check Nginx config inside the container: `docker exec tonghua-frontend cat /etc/nginx/conf.d/tonghua.conf`
4. Check both containers share the `tonghua-net` network

### Database Migrations Fail

```bash
# Check if init-db scripts ran
docker compose logs mysql | grep "docker-entrypoint-initdb.d"

# Re-run by removing the volume (WARNING: deletes all data)
docker compose down -v
docker compose up -d mysql
```

### Build Failures

```bash
# Clear Docker build cache
docker builder prune -f

# Rebuild without cache
docker compose build --no-cache backend

# Check disk space
df -h
docker system df
```

### Permission Denied Errors

The backend runs as non-root user `tonghua` (UID mapped inside the container). If you mount local volumes for development:

```bash
# Fix ownership of mounted directories
sudo chown -R 1000:1000 backend/
```

---

## Security Hardening

### TLS/SSL Configuration

For production, terminate TLS at Nginx. Add the following to `nginx.conf`:

```nginx
server {
    listen 443 ssl http2;
    server_name tonghua.org www.tonghua.org;

    ssl_certificate     /etc/nginx/ssl/fullchain.pem;
    ssl_certificate_key /etc/nginx/ssl/privkey.pem;
    ssl_protocols       TLSv1.2 TLSv1.3;
    ssl_ciphers         ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers on;
    ssl_session_cache   shared:SSL:10m;
    ssl_session_timeout 10m;
    ssl_stapling        on;
    ssl_stapling_verify on;

    # ... existing location blocks ...
}

server {
    listen 80;
    server_name tonghua.org www.tonghua.org;
    return 301 https://$host$request_uri;
}
```

Mount certificates into the frontend container by adding to `docker-compose.yml`:

```yaml
frontend:
  volumes:
    - /path/to/ssl:/etc/nginx/ssl:ro
```

Or use Let's Encrypt with certbot for automated certificate management.

### Secrets Management

1. **Never commit `.env` files** -- `.env` is in `.gitignore`
2. **Use a secrets manager** in production (HashiCorp Vault, AWS Secrets Manager, or similar)
3. **Rotate secrets regularly** -- especially JWT keys and encryption keys
4. **Use separate keys for children's data** -- `CHILD_DATA_ENCRYPTION_KEY` must be different from `ENCRYPTION_KEY`
5. **Restrict file permissions**: `chmod 600 .env`

### Container Security

- All containers run as non-root users where possible
- Backend Dockerfile creates and switches to user `tonghua`
- Base images use `slim` or `alpine` variants to minimize attack surface
- No unnecessary packages installed in production images

### Network Security

- All inter-service communication is on the internal `tonghua-net` bridge network
- Only necessary ports are exposed to the host
- In production, expose only ports 80 and 443
- Block direct access to MySQL (3306), Redis (6379), and RabbitMQ (5672) from the public internet

### API Security

The following are enforced by the backend and Nginx:

- **Rate limiting**: 1000 QPS global, 60 QPM per user, 20 QPS per IP
- **CORS**: restricted to allowed origins only
- **CSP headers**: set via Nginx (customize for your domains)
- **Input validation**: on all API endpoints
- **HMAC-SHA256 request signing**: for sensitive operations

### Children's Data Protection

Per the project's legal and security requirements:

- Children's PII (names, photos, IDs) encrypted with a separate AES-256-GCM key
- Frontend displays are always desensitized (masked names, watermarked images)
- Access to full data requires two-level approval in the admin system
- All access to children's data is logged with user ID and timestamp
- Data retention policies enforced per the privacy policy
