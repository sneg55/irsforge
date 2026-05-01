export interface PartyEntry {
  identifier: string
  displayName: string
  hint?: string
}

export interface DirectoryConfig {
  entries?: PartyEntry[]
  ledgerUrl?: string
  proxyUrl?: string
  token?: string | (() => string | Promise<string>)
}
