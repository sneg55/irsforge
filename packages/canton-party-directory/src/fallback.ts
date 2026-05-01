/** Extract the hint portion before the :: namespace separator. */
export function extractHint(identifier: string): string {
  const idx = identifier.indexOf('::')
  return idx === -1 ? identifier : identifier.slice(0, idx)
}

/** Truncate a string to maxLen characters, appending ... if truncated. */
export function truncate(str: string, maxLen: number): string {
  return str.length <= maxLen ? str : `${str.slice(0, maxLen)}...`
}

/**
 * Shorten a party identifier for hover display. Keeps the hint prefix and
 * shortens the fingerprint to `first12…last12`. If no `::` is present, the
 * whole string is shortened.
 */
export function shortenIdentifier(identifier: string): string {
  const idx = identifier.indexOf('::')
  if (idx === -1) {
    if (identifier.length <= 25) return identifier
    return `${identifier.slice(0, 12)}…${identifier.slice(-12)}`
  }
  const hint = identifier.slice(0, idx)
  const fingerprint = identifier.slice(idx + 2)
  if (fingerprint.length <= 25) return identifier
  return `${hint}::${fingerprint.slice(0, 12)}…${fingerprint.slice(-12)}`
}

/** Get 2-char initials from a display name. */
export function getInitials(name: string): string {
  if (!name) return ''
  const words = name.trim().split(/\s+/)
  if (words.length >= 2) {
    return (words[0][0] + words[1][0]).toUpperCase()
  }
  return name.slice(0, 2).toUpperCase()
}
