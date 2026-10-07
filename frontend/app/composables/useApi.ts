import { message } from 'ant-design-vue'
import { AUTH_TOKEN } from '~/utils/storageKeys'

export interface ApiResponse<T = any> {
  status: boolean
  message: string
  data: T
}

// $fetch instance for the Laravel API: adds the bearer token and handles 401/403
export const useApi = () => {
  const config = useRuntimeConfig()

  return $fetch.create({
    baseURL: config.public.apiBase,
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'X-Requested-With': 'XMLHttpRequest',
    },
    onRequest({ options }) {
      const token = localStorage.getItem(AUTH_TOKEN)
      if (token) {
        options.headers.set('Authorization', `Bearer ${token}`)
      }
    },
    onResponseError({ response }) {
      if (response.status === 401) {
        localStorage.clear()
        // Full reload resets the store and lands on login
        window.location.href = '/'
      } else if (response.status === 403) {
        message.error(response._data?.message || 'Forbidden')
      }
    },
  })
}
