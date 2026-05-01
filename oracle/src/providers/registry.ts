import type { OracleProvider } from './types.js'

const registry = new Map<string, OracleProvider>()

export function registerProvider(provider: OracleProvider): void {
  registry.set(provider.id, provider)
  console.log(
    `Oracle provider registered: ${provider.id} (rates: ${provider.supportedRateIds.join(', ')})`,
  )
}

export function getProvider(id: string): OracleProvider {
  const provider = registry.get(id)
  if (!provider) {
    throw new Error(
      `Oracle provider not found: ${id}. Registered: ${[...registry.keys()].join(', ')}`,
    )
  }
  return provider
}

export function listProviders(): OracleProvider[] {
  return [...registry.values()]
}

export interface ProviderRefValidationError {
  ccy: string
  curveType: 'discount' | 'projection'
  providerId: string
}

/**
 * Walks the curve config and returns one ProviderRefValidationError per
 * provider id that is not registered. Used at oracle startup to fail
 * fast with a precise message before any service work begins.
 */
export function validateProviderRefs(
  config: {
    curves?: {
      currencies: Record<
        string,
        { discount: { provider: string }; projection: { provider: string } }
      >
    }
  },
  registeredIds: Set<string>,
): ProviderRefValidationError[] {
  const errors: ProviderRefValidationError[] = []
  for (const [ccy, c] of Object.entries(config.curves?.currencies ?? {})) {
    if (!registeredIds.has(c.discount.provider)) {
      errors.push({ ccy, curveType: 'discount', providerId: c.discount.provider })
    }
    if (!registeredIds.has(c.projection.provider)) {
      errors.push({ ccy, curveType: 'projection', providerId: c.projection.provider })
    }
  }
  return errors
}
