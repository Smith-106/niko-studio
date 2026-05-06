/**
 * Blob download utility
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  setTimeout(() => {
    try {
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch {
      // Environment torn down (e.g. test finished)
    }
  }, 100)
}
