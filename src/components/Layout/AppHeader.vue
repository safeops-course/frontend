<script setup>
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import { useBackendStore } from '../../stores/backend'
import { useAuthStore } from '../../stores/auth'

const backendStore = useBackendStore()
const authStore = useAuthStore()

const statusColor = computed(() => {
  switch (backendStore.healthStatus) {
    case 'healthy': return 'bg-green-500'
    case 'not-ready': return 'bg-yellow-500'
    case 'not-live': return 'bg-orange-500'
    default: return 'bg-red-500'
  }
})

function logout() {
  authStore.logout()
}
</script>

<template>
  <header class="bg-slate-800 border-b border-slate-700">
    <div class="px-6 py-4 flex items-center justify-between">
      <div class="flex items-center gap-4">
        <h1 class="text-2xl font-bold text-white">SRE Control Plane</h1>
        <div class="flex items-center gap-2">
          <div :class="['w-2 h-2 rounded-full', statusColor]"></div>
          <span class="text-sm text-slate-400">{{ backendStore.healthStatus }}</span>
        </div>
      </div>
      <div class="flex items-center gap-4 text-sm text-slate-400">
        <span v-if="backendStore.version">
          {{ backendStore.version.version || 'dev' }}
        </span>
        <span v-if="backendStore.version">
          {{ backendStore.version.commit_short }}
        </span>

        <RouterLink
          v-if="!authStore.isAuthenticated"
          to="/auth"
          class="px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200"
        >
          Login / Register
        </RouterLink>

        <div v-else class="flex items-center gap-2">
          <span class="text-emerald-400">🔐 {{ authStore.username }}</span>
          <button
            @click="logout"
            class="px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200"
          >
            Logout
          </button>
        </div>
      </div>
    </div>
  </header>
</template>
