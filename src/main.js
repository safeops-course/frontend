import { createApp } from 'vue'
import { createPinia } from 'pinia'
import VueApexCharts from 'vue3-apexcharts'
import router from './router'
import App from './App.vue'
import './style.css'
import { initTelemetry, recordError } from './services/telemetry'

// Initialize OpenTelemetry before anything else
try {
  initTelemetry()
} catch (err) {
  console.error('[Telemetry] Failed to initialize:', err)
}

const app = createApp(App)

app.use(createPinia())
app.use(router)
app.use(VueApexCharts)

// Capture unhandled Vue errors as OTel spans
app.config.errorHandler = (error, instance, info) => {
  console.error('[Vue] Unhandled error:', error, info)
  try {
    recordError(error, info)
  } catch {
    // telemetry failure should not crash the app
  }
}

app.mount('#app')
