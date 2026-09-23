# Frontend (Vue 3)

SRE Control Plane Dashboard, part of the [SafeOps Academy](https://safeops.work/) course. Vue 3 SPA providing real-time health monitoring, chaos engineering controls, API exploration, and environment info. Served via nginx, deployed via [FluxCD](https://fluxcd.io/) to k3s on Hetzner Cloud with automatic image updates.

## Pages

| Route | Description |
|---|---|
| `/` | Dashboard — health probes, version info, live metrics charts |
| `/chaos` | Chaos Engineering — toggle probes, inject delays/errors, trigger panics |
| `/api-explorer` | API Explorer — interactive endpoint testing against the backend |
| `/environment` | Environment — runtime config, request headers |
| `/auth` | Authentication — login/register with JWT |

## Tech Stack

- **Vue 3** with Composition API (`<script setup>`)
- **Vite 7** build tooling
- **Tailwind CSS v4** (PostCSS plugin, CSS-first config)
- **Pinia 3** state management
- **Vue Router 4** SPA routing
- **Axios** HTTP client
- **ApexCharts** (vue3-apexcharts) dashboard charts
- **OpenTelemetry** browser SDK for distributed tracing
- **nginx 1.28-alpine** production serving

## Runtime Configuration

The app uses `window.__ENV__` for runtime config, injected by an nginx entrypoint script at container startup. This allows the same Docker image across all environments.

| Variable | Description |
|---|---|
| `VITE_API_URL` | Backend API base URL |
| `VITE_UPTRACE_DSN` | Uptrace DSN for browser tracing |
| `ENVIRONMENT` | Current environment name |
| `VERSION` | App version |
| `COMMIT` | Git commit SHA |
| `BUILD_DATE` | Build timestamp |

Fallback chain: `window.__ENV__` → `import.meta.env` → localhost defaults.

## CI/CD

Two GitHub Actions workflows:

- **build.yml** — triggers on push to `main`/`develop`: builds multi-platform Docker image (linux/amd64 + linux/arm64), pushes to GHCR, signs with cosign (keyless), generates SBOM attestation (SPDX), runs Trivy vulnerability scan (non-blocking)
- **promote-production.yml** — manual trigger: runs Trivy scan (blocking on CRITICAL), re-tags staging image as production, creates GitHub Release, bumps version tag

Images are pushed to `ghcr.io/safeops-course/frontend` with tags like `develop-v0.0.1-abc1234-1234567890`.

## Kubernetes Deployment

Deployed via FluxCD with environment overlays (manifests in the [sre](https://github.com/safeops-course/sre) repo):

- **develop** — 1 replica, minimal resources
- **staging** — 1 replica, moderate resources
- **production** — 2 replicas, higher resource limits

Image tags are automatically updated by Flux ImageUpdateAutomation.

## Nginx Configuration

- Listens on port **8080** (non-root compatible)
- SPA routing: all routes fall back to `index.html`
- `/config.js` served from `/tmp/config.js` (runtime-generated, no-cache)
- `/health` returns 200 for container health checks
- Security headers: X-Frame-Options, X-Content-Type-Options, X-XSS-Protection, Referrer-Policy
- Static assets cached for 1 year with immutable flag
- Gzip compression enabled

## Docker

The production build uses a multi-stage Dockerfile:

1. **Builder stage** — `node:24-alpine`, `npm ci`, `npm run build`
2. **Runtime stage** — `nginx:1.28-alpine`, non-root user (uid 10001), read-only root filesystem

```bash
docker build -t frontend:local .
docker run -p 8080:8080 -e VITE_API_URL=http://localhost:8080 frontend:local
```

## Local Development

```bash
npm install
npm run dev       # http://localhost:5173
npm run build     # production build to dist/
npm run preview   # preview production build
```

Create a `.env` file for local dev:

```env
VITE_API_URL=http://localhost:8080
```

## Project Structure

```
src/
  main.js                    # Entry point (Pinia, Router, ApexCharts, OTel)
  App.vue                    # Root component with Layout
  style.css                  # Global styles (Tailwind v4)
  router/index.js            # Vue Router config
  services/
    api.js                   # Axios client for backend API
    telemetry.js             # OpenTelemetry browser SDK init
  stores/
    backend.js               # Pinia store for backend state
    auth.js                  # Pinia store for authentication
  views/                     # Page components
  components/
    Layout/                  # Navigation, sidebar
    Dashboard/               # Dashboard-specific components
nginx/
  nginx.conf                # Main nginx config
  default.conf              # Server block config
Dockerfile                   # Multi-stage build
```
