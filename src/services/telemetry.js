import { WebTracerProvider } from '@opentelemetry/sdk-trace-web'
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http'
import { SpanKind, SpanStatusCode, trace } from '@opentelemetry/api'
import { resourceFromAttributes } from '@opentelemetry/resources'
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from '@opentelemetry/semantic-conventions'
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-web'
import { ZoneContextManager } from '@opentelemetry/context-zone'
import { registerInstrumentations } from '@opentelemetry/instrumentation'
import { FetchInstrumentation } from '@opentelemetry/instrumentation-fetch'
import { XMLHttpRequestInstrumentation } from '@opentelemetry/instrumentation-xml-http-request'
import { DocumentLoadInstrumentation } from '@opentelemetry/instrumentation-document-load'
import { UserInteractionInstrumentation } from '@opentelemetry/instrumentation-user-interaction'

const DEFAULT_TRACE_HEADER_CORS_URLS = [
  /localhost/,
  /\.local$/,
  /\.svc\.cluster\.local$/,
  /\.safeops\.work$/,
]

const DEFAULT_IGNORED_HTTP_URLS = [
  /\/healthz(?:\?.*)?$/,
  /\/readyz(?:\?.*)?$/,
  /\/livez(?:\?.*)?$/,
  /\/metrics(?:\?.*)?$/,
]

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function buildTraceHeaderCorsUrls(apiUrl) {
  const rules = [...DEFAULT_TRACE_HEADER_CORS_URLS]
  if (!apiUrl) {
    return rules
  }

  try {
    const origin = new URL(apiUrl, window.location.origin).origin
    rules.push(new RegExp(`^${escapeRegExp(origin)}`))
  } catch {
    console.warn('[Telemetry] Failed to parse API URL for trace header propagation:', apiUrl)
  }

  return rules
}

// The only collector origins the image's CSP allows (nginx/security-headers.conf, connect-src):
// the page's own origin and Uptrace. Keep both lists in sync. `npm run dev` has no CSP.
const UPTRACE_ORIGIN = 'https://api.uptrace.dev'

// Returns the collector URL if the built app may send to it, or '' (with a warning) if the CSP
// would block it - better to say so once than to lose every span silently.
function allowedCollectorUrl(url) {
  if (!url || !import.meta.env.PROD) {
    return url
  }
  let origin
  try {
    origin = new URL(url, window.location.origin).origin
  } catch {
    console.warn('[Telemetry] Invalid collector URL, spans are not exported:', url)
    return ''
  }
  if (origin === window.location.origin || origin === UPTRACE_ORIGIN) {
    return url
  }
  console.warn(
    `[Telemetry] Collector origin ${origin} is not allowed by the CSP (connect-src 'self' ${UPTRACE_ORIGIN}); spans are not exported`,
  )
  return ''
}

// Get configuration from environment
const getConfig = () => {
  // Uptrace DSN format: https://TOKEN@api.uptrace.dev
  const uptraceDsn = window.__ENV__?.VITE_UPTRACE_DSN || import.meta.env.VITE_UPTRACE_DSN || ''
  const apiUrl = window.__ENV__?.VITE_API_URL || import.meta.env.VITE_API_URL || window.location.origin

  // No default collector: a fallback to http://localhost:4318 made every visitor's browser send
  // requests to a port on the visitor's own machine. Without a DSN or an explicit collector URL,
  // spans are created (trace context still reaches the backend) but not exported.
  let collectorUrl = window.__ENV__?.VITE_OTEL_COLLECTOR_URL || import.meta.env.VITE_OTEL_COLLECTOR_URL || ''
  let headers = {}

  // If Uptrace DSN is set, use Uptrace directly
  if (uptraceDsn) {
    collectorUrl = `${UPTRACE_ORIGIN}/v1/traces`
    // Extract token from DSN (format: https://TOKEN@api.uptrace.dev)
    const match = uptraceDsn.match(/https:\/\/([^@]+)@/)
    if (match) {
      headers['uptrace-dsn'] = uptraceDsn
    }
  }

  collectorUrl = allowedCollectorUrl(collectorUrl)

  return {
    serviceName: 'frontend',
    serviceVersion: window.__ENV__?.VERSION || import.meta.env.VITE_VERSION || '0.0.0-dev',
    environment: window.__ENV__?.ENVIRONMENT || import.meta.env.MODE || 'development',
    clusterName: window.__ENV__?.CLUSTER_NAME || '',
    collectorUrl,
    headers,
    traceHeaderCorsUrls: buildTraceHeaderCorsUrls(apiUrl),
  }
}

export function initTelemetry() {
  const config = getConfig()

  console.log('[Telemetry] Initializing OpenTelemetry...', {
    service: config.serviceName,
    version: config.serviceVersion,
    environment: config.environment,
    cluster: config.clusterName,
    collector: config.collectorUrl,
  })

  // Create resource with service metadata
  const resourceAttrs = {
    [ATTR_SERVICE_NAME]: config.serviceName,
    [ATTR_SERVICE_VERSION]: config.serviceVersion,
    'deployment.environment': config.environment,
  }
  if (config.clusterName) {
    resourceAttrs['k8s.cluster.name'] = config.clusterName
  }
  const resource = resourceFromAttributes(resourceAttrs)

  // Export only to a configured destination (Uptrace DSN or VITE_OTEL_COLLECTOR_URL). The CSP in
  // nginx/security-headers.conf allows connect-src to 'self' and https://api.uptrace.dev only.
  const spanProcessors = []
  if (config.collectorUrl) {
    const exporter = new OTLPTraceExporter({
      url: config.collectorUrl,
      headers: config.headers,
    })
    spanProcessors.push(
      new BatchSpanProcessor(exporter, {
        maxQueueSize: 100,
        maxExportBatchSize: 10,
        scheduledDelayMillis: 500,
      }),
    )
  } else {
    console.log('[Telemetry] No Uptrace DSN or collector URL configured: spans are not exported')
  }

  // Create tracer provider (v2.x API)
  const provider = new WebTracerProvider({
    resource,
    spanProcessors,
  })

  // Register with ZoneContextManager for async context propagation
  provider.register({
    contextManager: new ZoneContextManager(),
  })

  // Register auto-instrumentations
  registerInstrumentations({
    instrumentations: [
      // Fetch API instrumentation (for axios and fetch)
      new FetchInstrumentation({
        propagateTraceHeaderCorsUrls: config.traceHeaderCorsUrls,
        ignoreUrls: DEFAULT_IGNORED_HTTP_URLS,
        clearTimingResources: true,
        applyCustomAttributesOnSpan: (span, request, response) => {
          if (response) {
            span.setAttribute('http.response.status_code', response.status)
            span.setAttribute('http.response.status_text', response.statusText)
          }
          if (request) {
            span.setAttribute('http.request.method', request.method || 'GET')
          }
        },
      }),

      // XMLHttpRequest instrumentation (backup)
      new XMLHttpRequestInstrumentation({
        propagateTraceHeaderCorsUrls: config.traceHeaderCorsUrls,
        ignoreUrls: DEFAULT_IGNORED_HTTP_URLS,
        applyCustomAttributesOnSpan: (span, xhr) => {
          span.setAttribute('http.response.status_code', xhr.status || 0)
          span.setAttribute('http.response.status_text', xhr.statusText || '')
          span.setAttribute('http.url', xhr.responseURL || '')
          if (xhr.status === 0) {
            span.setAttribute('error.type', 'network_error')
          }
        },
      }),

      // Document load instrumentation (page load performance)
      new DocumentLoadInstrumentation(),

      // User interaction instrumentation (clicks, etc)
      new UserInteractionInstrumentation({
        eventNames: ['click', 'submit'],
      }),
    ],
  })

  console.log('[Telemetry] OpenTelemetry initialized successfully')

  return provider
}

// Export tracer for manual instrumentation
export function getTracer() {
  const version = window.__ENV__?.VERSION || import.meta.env.VITE_VERSION || '0.0.0-dev'
  return trace.getTracer('frontend', version)
}

// Helper for manual UI/business spans around async actions.
export async function withSpan(name, attributes = {}, fn) {
  const tracer = getTracer()
  const span = tracer.startSpan(name, { kind: SpanKind.CLIENT })

  try {
    Object.entries(attributes).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        span.setAttribute(key, value)
      }
    })
    return await fn(span)
  } catch (error) {
    span.recordException(error)
    span.setStatus({ code: SpanStatusCode.ERROR, message: error?.message || 'operation failed' })

    if (error?.name) {
      span.setAttribute('error.type', error.name)
    }
    if (error?.config?.url) {
      span.setAttribute('http.url', error.config.url)
    }
    if (error?.config?.method) {
      span.setAttribute('http.request.method', String(error.config.method).toUpperCase())
    }
    if (error?.response?.status) {
      span.setAttribute('http.response.status_code', error.response.status)
    }
    if (error?.response?.data?.error) {
      span.setAttribute('app.error.detail', String(error.response.data.error))
    }
    throw error
  } finally {
    span.end()
  }
}

// Record an unhandled error as a span (used by Vue error handler)
export function recordError(error, info) {
  const tracer = getTracer()
  const span = tracer.startSpan('vue.error', { kind: SpanKind.CLIENT })
  span.recordException(error)
  span.setStatus({ code: SpanStatusCode.ERROR, message: error?.message || 'unhandled error' })
  if (error?.name) {
    span.setAttribute('error.type', error.name)
  }
  if (info) {
    span.setAttribute('vue.error.info', info)
  }
  span.end()
}
