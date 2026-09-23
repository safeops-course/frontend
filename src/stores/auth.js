import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { api } from '../services/api'

const AUTH_TOKEN_KEY = 'sre_jwt_token'
const AUTH_USER_KEY = 'sre_jwt_user'

export const useAuthStore = defineStore('auth', () => {
  const token = ref(localStorage.getItem(AUTH_TOKEN_KEY) || '')
  const username = ref(localStorage.getItem(AUTH_USER_KEY) || '')
  const loading = ref(false)
  const error = ref('')

  const isAuthenticated = computed(() => token.value.trim().length > 0)

  function setSession(nextToken, nextUsername) {
    token.value = nextToken
    username.value = nextUsername
    localStorage.setItem(AUTH_TOKEN_KEY, nextToken)
    localStorage.setItem(AUTH_USER_KEY, nextUsername)
  }

  function clearSession() {
    token.value = ''
    username.value = ''
    localStorage.removeItem(AUTH_TOKEN_KEY)
    localStorage.removeItem(AUTH_USER_KEY)
  }

  async function register(usernameInput, passwordInput) {
    loading.value = true
    error.value = ''
    try {
      const response = await api.register(usernameInput, passwordInput)
      const payload = response.data || {}
      setSession(payload.token, payload.user?.username || usernameInput.trim())
      return payload
    } catch (err) {
      error.value = err.response?.data?.error || err.message
      throw err
    } finally {
      loading.value = false
    }
  }

  async function login(usernameInput, passwordInput) {
    loading.value = true
    error.value = ''
    try {
      const response = await api.login(usernameInput, passwordInput)
      const payload = response.data || {}
      setSession(payload.token, payload.user?.username || usernameInput.trim())
      return payload
    } catch (err) {
      error.value = err.response?.data?.error || err.message
      throw err
    } finally {
      loading.value = false
    }
  }

  async function restoreSession() {
    if (!isAuthenticated.value) {
      return
    }

    try {
      const response = await api.getMe()
      const nextUsername = response.data?.username
      if (nextUsername) {
        username.value = nextUsername
        localStorage.setItem(AUTH_USER_KEY, nextUsername)
      }
    } catch (err) {
      const status = err.response?.status
      if (status === 401 || status === 403) {
        clearSession()
      }
    }
  }

  function logout() {
    clearSession()
  }

  return {
    token,
    username,
    loading,
    error,
    isAuthenticated,
    register,
    login,
    restoreSession,
    logout,
  }
})
