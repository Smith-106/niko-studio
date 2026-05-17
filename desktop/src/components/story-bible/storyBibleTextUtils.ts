export function readText(value: unknown): string {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value)
  }
  return typeof value === 'string' ? value : ''
}

export function readString(value: unknown): string {
  return typeof value === 'string' ? value : ''
}
