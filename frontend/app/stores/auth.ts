import { defineStore } from 'pinia'
import { AUTH_TOKEN } from '~/utils/storageKeys'
import type { AuthUser } from '~/utils/homeRoute'
import type { ApiResponse } from '~/composables/useApi'

export const useAuthStore = defineStore('auth', () => {
  const user = ref<AuthUser | null>(null)
  const authToken = ref<string | null>(localStorage.getItem(AUTH_TOKEN) || null)

  const isLoggedIn = computed(() => !!authToken.value)

  const updateUser = (newVal: AuthUser | null) => {
    user.value = newVal
  }

  const updateAuthToken = (newVal: string | null) => {
    authToken.value = newVal
    if (newVal) {
      localStorage.setItem(AUTH_TOKEN, newVal)
    } else {
      localStorage.removeItem(AUTH_TOKEN)
    }
  }

  const fetchUser = async () => {
    if (!authToken.value) return

    try {
      const api = useApi()
      const response = await api<ApiResponse<{ user: AuthUser }>>('/user')
      updateUser(response.data.user)
    } catch {
      // Stale or invalid token
      updateAuthToken(null)
      updateUser(null)
    }
  }

  const logoutAction = async () => {
    if (!authToken.value) return

    try {
      const api = useApi()
      await api('/logout')
    } catch {
      // Log out locally even if the token is already invalid
    }

    localStorage.clear()
    updateAuthToken(null)
    updateUser(null)

    await navigateTo('/')
  }

  return {
    user,
    updateUser,
    isLoggedIn,

    authToken,
    updateAuthToken,

    fetchUser,
    logoutAction,
  }
})
