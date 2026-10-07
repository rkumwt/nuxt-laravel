import type { TablePaginationConfig } from 'ant-design-vue'
import type { ApiResponse } from './useApi'

interface Paginated<T> {
  data: T[]
  meta: { current_page: number, last_page: number, per_page: number, total: number }
}

export const useDatatable = <T = any>() => {
  const api = useApi()
  const data = ref<T[]>([]) as Ref<T[]>
  const loading = ref(false)
  const pageSize = ref(10)
  const currentPage = ref(1)
  const tablePagination = ref<TablePaginationConfig>({
    pageSize: pageSize.value,
    showSizeChanger: true,
  })
  const url = ref('')
  const params = ref<Record<string, any>>({})

  const fetchData = async () => {
    loading.value = true

    try {
      const res = await api<ApiResponse<Paginated<T>>>(url.value, {
        body: {
          per_page: pageSize.value,
          page: currentPage.value,
          ...params.value,
        },
      })

      data.value = res.data.data
      tablePagination.value = {
        ...tablePagination.value,
        current: res.data.meta.current_page,
        total: res.data.meta.total,
      }
    } finally {
      loading.value = false
    }
  }

  const handleTableChange = (pagination: TablePaginationConfig) => {
    pageSize.value = pagination.pageSize ?? 10
    currentPage.value = pagination.current ?? 1

    tablePagination.value = {
      ...pagination,
    }

    fetchData()
  }

  // Reset to the first page, e.g. after a filter change
  const reload = () => {
    currentPage.value = 1
    return fetchData()
  }

  return {
    url,
    params,
    data,
    loading,
    tablePagination,

    fetchData,
    reload,
    handleTableChange,
  }
}
