<script setup>
import { onMounted } from 'vue'
import { RouterView } from 'vue-router'
import AppHeader from './components/Layout/AppHeader.vue'
import AppSidebar from './components/Layout/AppSidebar.vue'
import { useAuthStore } from './stores/auth'

const authStore = useAuthStore()

onMounted(() => {
  authStore.restoreSession()
})
</script>

<template>
  <div class="min-h-screen bg-slate-900">
    <AppHeader />
    <div class="flex">
      <AppSidebar />
      <main class="flex-1 p-6">
        <RouterView />
      </main>
    </div>
  </div>
</template>
