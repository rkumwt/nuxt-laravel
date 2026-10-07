// POSTs to a download endpoint and saves the returned file
export const useDownload = () => {
  const api = useApi()
  const downloading = ref(false)

  const download = async (url: string, payload: Record<string, any>, fileName: string, docType = 'text/csv') => {
    downloading.value = true

    try {
      const response = await api<Blob>(url, {
        body: payload,
        responseType: 'blob',
      })

      const blob = new Blob([response], { type: docType })
      const objectUrl = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = objectUrl
      link.setAttribute('download', fileName)
      document.body.appendChild(link)
      link.click()

      document.body.removeChild(link)
      window.URL.revokeObjectURL(objectUrl)
    } catch {
      // Errors are surfaced by the api interceptor
    } finally {
      downloading.value = false
    }
  }

  return {
    downloading,
    download,
  }
}
