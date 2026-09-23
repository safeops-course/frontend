# Frontend Telemetry

Този документ описва текущото състояние на телеметрията във frontend приложението.

## Обхват

Frontend праща:
- browser traces (OpenTelemetry Web SDK)
- automatic HTTP spans (Fetch + XHR instrumentation)
- UI/business spans през `withSpan(...)`
- error details към активния span през axios interceptor

## Инициализация

Flow:
- `src/main.js` извиква `initTelemetry()` преди `app.mount(...)`.
- `src/services/telemetry.js` създава:
- `WebTracerProvider`
- `OTLPTraceExporter`
- `BatchSpanProcessor`
- Ресурсни атрибути:
- `service.name=frontend`
- `service.version=1.0.0`
- `deployment.environment`

Exporter конфигурация:
- Ако има `VITE_UPTRACE_DSN`, exporter URL става `https://api.uptrace.dev/v1/traces`.
- Ако няма, използва `VITE_OTEL_COLLECTOR_URL` (или default `http://localhost:4318/v1/traces`).

## Активни instrumentation-и

`src/services/telemetry.js` регистрира:
- `FetchInstrumentation`
- `XMLHttpRequestInstrumentation`
- `DocumentLoadInstrumentation`
- `UserInteractionInstrumentation` (events: `click`, `submit`)

## Trace propagation

Frontend праща trace headers към backend origin:
- `traceparent`
- `tracestate`
- `baggage`

`propagateTraceHeaderCorsUrls` се изгражда динамично:
- включва стандартни локални правила (`localhost`, `.local`, `.svc.cluster.local`)
- добавя и origin от `VITE_API_URL`

## Error обогатяване

### В `withSpan(...)`

При exception:
- `span.recordException(error)`
- `SpanStatusCode.ERROR`
- атрибути:
- `error.type`
- `error.message`
- `http.url`
- `http.request.method`
- `http.response.status_code`
- `app.error.detail` (ако backend връща `{"error": ...}`)

### В axios interceptor (`src/services/api.js`)

При response error:
- взима `trace.getActiveSpan()`
- записва exception и status=ERROR
- добавя `method/url/status` + backend error detail

## Noise control (анти-шум)

За да не flood-ва Uptrace при health polling:
- `FetchInstrumentation` и `XMLHttpRequestInstrumentation` игнорират:
- `/healthz`
- `/readyz`
- `/livez`
- `/metrics`

В axios има допълнителен suppress:
- за горните endpoint-и, `ERR_NETWORK` и 5xx не се репортват като отделни exception telemetry събития.

Dashboard polling оптимизация:
- `src/views/DashboardView.vue` polling е на 5s само при активен tab.
- При `document.hidden` polling спира.
- При връщане на tab-а се пуска пак и прави незабавен refresh.

## Ръчни UI spans

`withSpan(...)` се ползва в:
- `src/stores/backend.js`
- `src/views/ApiExplorerView.vue`
- `src/views/ChaosView.vue`

Примери за span имена:
- `ui.dashboard.fetch_version`
- `ui.dashboard.fetch_health`
- `ui.dashboard.fetch_metrics`
- `ui.chaos.trigger_panic`
- `ui.api_explorer.test_endpoint`

## Конфигурация

Ключови env променливи:
- `VITE_UPTRACE_DSN`
- `VITE_OTEL_COLLECTOR_URL`
- `VITE_API_URL`
- `ENVIRONMENT`

## Бърз checklist за валидация

1. Browser console показва `OpenTelemetry initialized successfully`.
2. Действие в UI (например test endpoint в API Explorer) генерира span в Uptrace.
3. При backend error span-ът съдържа `http.url`, `http.response.status_code`, `app.error.detail`.
4. При временно паднал backend няма flood от health/metrics exception-и.
