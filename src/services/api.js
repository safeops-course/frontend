import axios from 'axios'
import { SpanStatusCode, trace } from '@opentelemetry/api'

const AUTH_TOKEN_KEY = 'sre_jwt_token'
const NOISY_ENDPOINTS = ['/healthz', '/readyz', '/livez', '/metrics']

function shouldSuppressErrorTelemetry(error) {
  const rawUrl = error?.config?.url || ''
  if (!rawUrl) {
    return false
  }

  let pathname = rawUrl
  try {
    pathname = new URL(rawUrl, window.location.origin).pathname
  } catch {
    pathname = rawUrl
  }

  const isNoisyEndpoint = NOISY_ENDPOINTS.some((endpoint) => pathname.endsWith(endpoint))
  if (!isNoisyEndpoint) {
    return false
  }

  // Health polling failures are expected during backend restarts/chaos drills.
  return error?.code === 'ERR_NETWORK' || error?.response?.status >= 500
}

// Get backend URL from environment or default to localhost
const API_BASE_URL = window.__ENV__?.VITE_API_URL || import.meta.env.VITE_API_URL || 'http://localhost:8080'

// Create axios instance with default config
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Request interceptor
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem(AUTH_TOKEN_KEY)
    if (token) {
      config.headers = config.headers || {}
      config.headers.Authorization = `Bearer ${token}`
    }

    console.log(`[API] ${config.method.toUpperCase()} ${config.url}`)
    return config
  },
  (error) => {
    console.error('[API] Request error:', error)
    return Promise.reject(error)
  }
)

// Response interceptor
apiClient.interceptors.response.use(
  (response) => {
    console.log(`[API] ${response.status} ${response.config.url}`)
    return response
  },
  (error) => {
    console.error('[API] Response error:', error.message)

    const span = trace.getActiveSpan()
    if (span && !shouldSuppressErrorTelemetry(error)) {
      span.recordException(error)
      span.setStatus({ code: SpanStatusCode.ERROR, message: error.message || 'request failed' })

      if (error.config?.method) {
        span.setAttribute('http.request.method', String(error.config.method).toUpperCase())
      }
      if (error.config?.url) {
        span.setAttribute('http.url', error.config.url)
      }
      if (error.response?.status) {
        span.setAttribute('http.response.status_code', error.response.status)
      }
      if (error.response?.data?.error) {
        span.setAttribute('app.error.detail', String(error.response.data.error))
      } else if (error.message) {
        span.setAttribute('error.message', error.message)
      }
      if (error.code) {
        span.setAttribute('error.type', String(error.code))
      }
    }

    return Promise.reject(error)
  }
)

// API methods
export const api = {
  // Auth
  register(username, password) {
    return apiClient.post('/auth/register', { username, password })
  },

  login(username, password) {
    return apiClient.post('/auth/login', { username, password })
  },

  getMe() {
    return apiClient.get('/auth/me')
  },

  // Health checks
  getHealth() {
    return apiClient.get('/healthz')
  },

  getReady() {
    return apiClient.get('/readyz')
  },

  enableReady() {
    return apiClient.put('/readyz/enable')
  },

  disableReady() {
    return apiClient.put('/readyz/disable')
  },

  getLive() {
    return apiClient.get('/livez')
  },

  enableLive() {
    return apiClient.put('/livez/enable')
  },

  disableLive() {
    return apiClient.put('/livez/disable')
  },

  // Version and info
  getVersion() {
    return apiClient.get('/version')
  },

  getEnv() {
    return apiClient.get('/env')
  },

  getHeaders() {
    return apiClient.get('/headers')
  },

  // Metrics
  getMetrics() {
    return apiClient.get('/metrics', {
      headers: { Accept: 'text/plain' },
      transformResponse: [(data) => data], // Keep as plain text
    })
  },

  // OpenAPI spec
  getOpenAPI() {
    return apiClient.get('/openapi')
  },

  // Chaos engineering
  triggerPanic() {
    return apiClient.get('/panic')
  },

  delay(seconds) {
    return apiClient.get(`/delay/${seconds}`)
  },

  status(code) {
    return apiClient.get(`/status/${code}`, {
      validateStatus: () => true, // Accept any status
    })
  },

  echo(body, contentType = 'application/json') {
    return apiClient.post('/echo', body, {
      headers: { 'Content-Type': contentType },
    })
  },
}

export default apiClient
