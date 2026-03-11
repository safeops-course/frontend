<script setup>
import { computed, ref } from 'vue'
import { useAuthStore } from '../stores/auth'

const authStore = useAuthStore()
const mode = ref('login')
const username = ref('')
const password = ref('')
const notice = ref('')

const isLogin = computed(() => mode.value === 'login')

async function submit() {
  notice.value = ''
  try {
    if (isLogin.value) {
      await authStore.login(username.value, password.value)
      notice.value = 'Успешен вход.'
    } else {
      await authStore.register(username.value, password.value)
      notice.value = 'Успешна регистрация и вход.'
    }
    password.value = ''
  } catch (err) {
    notice.value = authStore.error || 'Грешка при удостоверяване.'
  }
}

function switchMode(nextMode) {
  mode.value = nextMode
  notice.value = ''
  authStore.error = ''
}
</script>

<template>
  <div class="max-w-2xl mx-auto space-y-6">
    <div>
      <h2 class="text-3xl font-bold text-white mb-2">Auth</h2>
      <p class="text-slate-400">Регистрация и вход с JWT token</p>
    </div>

    <div class="bg-slate-800 rounded-lg border border-slate-700 p-6 space-y-4">
      <div class="flex gap-2">
        <button
          @click="switchMode('login')"
          :class="[
            'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
            isLogin ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
          ]"
        >
          Login
        </button>
        <button
          @click="switchMode('register')"
          :class="[
            'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
            !isLogin ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
          ]"
        >
          Register
        </button>
      </div>

      <div class="space-y-3">
        <div>
          <label class="block text-sm text-slate-300 mb-1">Username</label>
          <input
            v-model="username"
            type="text"
            autocomplete="username"
            class="w-full px-4 py-2 bg-slate-700 text-white rounded-lg border border-slate-600 focus:border-blue-500 focus:outline-none"
          />
        </div>

        <div>
          <label class="block text-sm text-slate-300 mb-1">Password</label>
          <input
            v-model="password"
            type="password"
            :autocomplete="isLogin ? 'current-password' : 'new-password'"
            class="w-full px-4 py-2 bg-slate-700 text-white rounded-lg border border-slate-600 focus:border-blue-500 focus:outline-none"
          />
          <p class="mt-1 text-xs text-slate-400">Минимум 8 символа.</p>
        </div>
      </div>

      <button
        @click="submit"
        :disabled="authStore.loading"
        class="w-full px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-900 text-white rounded-lg transition-colors"
      >
        {{ isLogin ? 'Login' : 'Register' }}
      </button>

      <div v-if="notice" class="text-sm rounded-lg p-3" :class="authStore.error ? 'bg-red-900/40 text-red-300 border border-red-700' : 'bg-green-900/40 text-green-300 border border-green-700'">
        {{ notice }}
      </div>

      <div v-if="authStore.isAuthenticated" class="text-sm text-slate-300 bg-slate-900/40 border border-slate-700 rounded-lg p-3">
        Влязъл потребител: <span class="font-semibold text-emerald-400">{{ authStore.username }}</span>
      </div>
    </div>
  </div>
</template>
