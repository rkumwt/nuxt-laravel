import { useAuthStore } from '~/stores/auth'
import { homeRouteFor, type UserType } from '~/utils/homeRoute'

declare module '#app' {
  interface PageMeta {
    requireAuth?: boolean
    requireUnauth?: boolean
    allowedUserType?: UserType[]
  }
}

export default defineNuxtRouteMiddleware((to) => {
  const authStore = useAuthStore()

  if (to.meta.requireAuth && !authStore.isLoggedIn) {
    return navigateTo('/')
  }

  if (to.path === '/' && authStore.isLoggedIn) {
    return navigateTo(homeRouteFor(authStore.user))
  }

  const allowedTypes = to.meta.allowedUserType
  if (allowedTypes && authStore.user && !allowedTypes.includes(authStore.user.type)) {
    return navigateTo(homeRouteFor(authStore.user))
  }
})
