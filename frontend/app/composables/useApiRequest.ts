import type { ApiResponse } from './useApi'

interface ApiRequestConfig {
  url: string
  data?: Record<string, any>
  success?: (res: ApiResponse) => void
  error?: (err: { status?: number, data?: any }) => void
}

// Form submit helper: tracks loading and exposes Laravel validation errors as `rules`
export const useApiRequest = () => {
  const api = useApi()
  const rules = ref<Record<string, string[]>>({})
  const loading = ref(false)

  const apiRequest = async (configObject: ApiRequestConfig) => {
    const { url, data } = configObject
    loading.value = true
    rules.value = {}

    try {
      const res = await api<ApiResponse>(url, { body: data ?? {} })
      loading.value = false

      configObject.success?.(res)
    } catch (err: any) {
      rules.value = err?.data?.errors ?? {}
      loading.value = false

      configObject.error?.({ status: err?.status, data: err?.data })
    }
  }

  return {
    rules,
    loading,
    apiRequest,
  }
}
