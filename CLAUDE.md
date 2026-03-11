# CLAUDE.md — SRE Frontend

## AI Agent Guidance

### Repository Context

This is the SRE Frontend — a Vue 3 SPA serving as the SRE Control Plane Dashboard. Companion UI for the SRE backend service, displaying health probes, chaos engineering controls, API exploration, and environment info. Served via nginx in Docker, deployed via FluxCD to k3s on Hetzner Cloud.

### AI Agent Operating Principles

**Critical Instructions for AI Agents:**

- **Tool Result Reflection**: After receiving tool results, carefully reflect on their quality and determine optimal next steps before proceeding. Use your thinking to plan and iterate based on this new information, and then take the best next action.
- **Parallel Execution**: For maximum efficiency, whenever you need to perform multiple independent operations, invoke all relevant tools simultaneously rather than sequentially.
- **Temporary File Management**: If you create any temporary new files, scripts, or helper files for iteration, clean up these files by removing them at the end of the task.
- **High-Quality Solutions**: Write high quality, general purpose solutions. Implement solutions that work correctly for all valid inputs, not just specific cases. Do not hard-code values or create solutions that only work for specific scenarios.
- **Problem Understanding**: Focus on understanding the problem requirements and implementing the correct approach. Provide principled implementations that follow best practices and software design principles.
- **Feasibility Assessment**: If the task is unreasonable or infeasible, say so. The solution should be robust, maintainable, and extendable.

### Zen Principles of This Repo

*Inspired by PEP 20 — The Zen of Python, applied to frontend code:*

- **Beautiful is better than ugly** — Clean, readable Vue components over complex nested logic
- **Explicit is better than implicit** — Clear prop names and documented intentions
- **Simple is better than complex** — Straightforward logic over clever abstractions
- **Complex is better than complicated** — When complexity is needed, make it organized not chaotic
- **Readability counts** — Code is read more often than written
- **Special cases aren't special enough to break the rules** — Consistency over exceptions
- **Errors should never pass silently** — Fail loud and early with clear messages
- **In the face of ambiguity, refuse the temptation to guess** — Test and verify, don't assume
- **If the implementation is hard to explain, it's a bad idea** — Complex patterns need clear documentation
- **If the implementation is easy to explain, it may be a good idea** — Simple solutions are often best
- **If you need a decoder ring to understand the code, rewrite it simpler** — No hieroglyphs!
- **There should be one obvious way to do it** — Establish patterns and stick to them
- **Be humble enough to build systems that are better than you** — Create safeguards that protect against human error, forgetfulness, and AI session resets

### Core Philosophical Principles

**KISS (Keep It Simple, Stupid)** — The fundamental principle guiding ALL decisions in this repository:
- Keep it simple and don't over-engineer solutions
- No hieroglyphs — code should be readable by humans, not just compilers
- Avoid complex regex patterns when simple logic works
- Replace nested function calls with clear step-by-step operations
- Use descriptive comments for complex validation logic
- If you need a decoder ring to understand the code, rewrite it simpler

**The "Be Humble" Principle** — Create safeguards that protect against:
- Human error and oversight
- AI session resets and context loss
- Complex edge cases that might be forgotten
- Future developers who may not understand the original intent

## Project Overview

Vue 3 SPA serving as the SRE Control Plane Dashboard — a companion UI for the SRE backend service. Displays health probes, chaos engineering controls, API exploration, and environment info. Served via nginx in Docker.

**Module:** `frontend` (Vue 3 + Vite)

## Project Structure

```text
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
    auth.js                  # Pinia store for authentication state
  views/
    DashboardView.vue        # Health probes, version info, charts
    ChaosView.vue            # Chaos engineering controls
    ApiExplorerView.vue       # API endpoint explorer
    EnvironmentView.vue       # Environment variables display
  components/
    Layout/                  # Navigation, sidebar
    Dashboard/               # Dashboard-specific components
  assets/                    # Static assets
nginx/
  nginx.conf                # Main nginx config
  default.conf              # Server block (SPA routing, /config.js, /health)
Dockerfile                   # Multi-stage: node builder → nginx runtime
```

## Key Technologies

- **Vue 3** with Composition API
- **Vite 7** for build tooling
- **Tailwind CSS v4** (PostCSS plugin, CSS-first config)
- **Vue Router 4** for SPA routing
- **Pinia 3** for state management
- **Axios** for HTTP client
- **ApexCharts** (vue3-apexcharts) for dashboard charts
- **OpenTelemetry** browser SDK for distributed tracing
- **nginx 1.28-alpine** for production serving

## Build & Run

```bash
npm install             # install dependencies
npm run dev             # vite dev server
npm run build           # production build to dist/
npm run preview         # preview production build
```

## Runtime Configuration

The app uses `window.__ENV__` for runtime config, injected by nginx entrypoint script (`40-generate-env-config.sh`). This allows the same Docker image to be used across environments.

| Env Var | Description |
|---|---|
| `VITE_API_URL` | Backend API base URL |
| `VITE_UPTRACE_DSN` | Uptrace DSN for browser tracing |
| `ENVIRONMENT` | Current environment name |
| `VERSION` | App version |
| `COMMIT` | Git commit SHA |
| `BUILD_DATE` | Build timestamp |

Fallback chain: `window.__ENV__` → `import.meta.env` → localhost defaults.

## Nginx Configuration

- Listens on port **8080** (non-root compatible)
- SPA routing: all routes fall back to `index.html`
- `/config.js` served from `/tmp/config.js` (runtime-generated) with no-cache headers
- `/health` endpoint returns 200 for container health checks
- Security headers: X-Frame-Options, X-Content-Type-Options, X-XSS-Protection, Referrer-Policy
- Static assets cached for 1 year with immutable flag

## CI/CD

- **build.yml** — on push to main/develop: build multi-platform Docker image (amd64+arm64), push to GHCR, Trivy scan (non-blocking)
- **promote-production.yml** — manual: Trivy gate (blocking, CRITICAL only), re-tag staging image as production, create GitHub Release, bump version tag

## Coding Guidelines

- Keep the dashboard simple — it's a reference/learning SPA, not a production product
- Runtime config via `window.__ENV__` — never hardcode API URLs or environment values
- No test framework configured — keep it simple
- Tailwind CSS v4 uses CSS-first configuration (no tailwind.config.js)
- Docker image runs as non-root user `appuser` (uid 10001)
- Trivy scans are non-blocking in CI (build), blocking for production promotion
