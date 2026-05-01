export interface Logger {
  info(data: Record<string, unknown>): void
  warn(data: Record<string, unknown>): void
  error(data: Record<string, unknown>): void
}

function write(
  channel: 'log' | 'error',
  level: 'info' | 'warn' | 'error',
  data: Record<string, unknown>,
): void {
  const payload = { level, ts: new Date().toISOString(), ...data }
  console[channel](JSON.stringify(payload))
}

export function createLogger(): Logger {
  return {
    info: (data) => write('log', 'info', data),
    warn: (data) => write('error', 'warn', data),
    error: (data) => write('error', 'error', data),
  }
}
