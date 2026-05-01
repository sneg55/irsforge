// Canton /v1/stream/query emits fully-qualified template IDs of shape
// "<package-id-hex>:Module.Path:Entity". A deny/allow prefix configured
// as `Daml.Finance.Holding` must match that form — so we look for the
// prefix AT or AFTER the first colon (package-id boundary), not at the
// start of the string.
export function templateIdMatchesPrefix(templateId: string, prefix: string): boolean {
  if (templateId.startsWith(prefix)) return true
  const colon = templateId.indexOf(':')
  if (colon === -1) return false
  return templateId.startsWith(prefix, colon + 1)
}

// Strip the Canton package-id prefix — "<hex>:Module.Path:Entity" → "Module.Path:Entity".
// Returns the input unchanged if there is no package-id prefix (single colon or none).
export function stripPackagePrefix(templateId: string): string {
  const parts = templateId.split(':')
  if (parts.length <= 2) return templateId
  return parts.slice(1).join(':')
}

// Last-two-segment short form for display — "pkg:Module.Path:Entity" → "Module.Path:Entity".
// Same as stripPackagePrefix for 3-part IDs, but also handles nested paths.
export function shortTemplate(templateId: string): string {
  const parts = templateId.split(':')
  if (parts.length <= 1) return templateId
  return parts.slice(-2).join(':')
}

// Tailwind class for the kind's accent color (border-left on toasts, text on rows/headers).
export function kindColorClass(
  kind: 'create' | 'exercise' | 'archive',
  variant: 'text' | 'border-l-bg' = 'text',
): string {
  if (variant === 'border-l-bg') {
    switch (kind) {
      case 'create':
        return 'border-l-green-500 bg-green-950/40 border-green-900'
      case 'exercise':
        return 'border-l-amber-500 bg-amber-950/40 border-amber-900'
      case 'archive':
        return 'border-l-red-500 bg-red-950/40 border-red-900'
    }
  }
  switch (kind) {
    case 'create':
      return 'text-green-400'
    case 'exercise':
      return 'text-amber-400'
    case 'archive':
      return 'text-red-400'
  }
}
