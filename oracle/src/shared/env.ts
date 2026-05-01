function getEnv(key: string, defaultValue?: string): string {
  const value = process.env[key] ?? defaultValue
  if (value === undefined) {
    throw new Error(`Missing required environment variable: ${key}`)
  }
  return value
}

function envKeyOf(prefix: string, accountId: string): string {
  return `${prefix}_${accountId.toUpperCase().replace(/-/g, '_')}`
}

export const ENV = {
  LEDGER_HOST: () => getEnv('LEDGER_HOST', 'localhost'),
  LEDGER_PORT: () => parseInt(getEnv('LEDGER_PORT', '7575')),
  OPERATOR_TOKEN: () => getEnv('OPERATOR_TOKEN', ''),
  MODE: () => getEnv('ORACLE_MODE', 'demo') as 'live' | 'demo',
  SCHEDULE_CRON: () => getEnv('ORACLE_SCHEDULE_CRON', '30 8 * * 1-5'),
  SCHEDULE_TZ: () => getEnv('ORACLE_SCHEDULE_TZ', 'America/New_York'),
  MARK_PUBLISHER_CRON: () => getEnv('MARK_PUBLISHER_CRON', '15 */1 * * * *'),
  // Service-account env vars are per-accountId. Compute the key at call time
  // (e.g. "scheduler" → "SERVICE_TOKEN_SCHEDULER"). Empty string means unset.
  SERVICE_TOKEN: (accountId: string) => getEnv(envKeyOf('SERVICE_TOKEN', accountId), ''),
  SERVICE_CLIENT_SECRET: (accountId: string) =>
    getEnv(envKeyOf('SERVICE_CLIENT_SECRET', accountId), ''),
} as const
