import { useAuthStore } from '~/stores/auth'

// Load the logged-in user before the first route guard runs
export default defineNuxtPlugin(async () => {
  const authStore = useAuthStore()
  await authStore.fetchUser()
})
