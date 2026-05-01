import { describe, expect, it } from 'vitest'
import {
  kindColorClass,
  shortTemplate,
  stripPackagePrefix,
  templateIdMatchesPrefix,
} from '../utils'

describe('templateIdMatchesPrefix', () => {
  it('matches when prefix is at the start of the string', () => {
    expect(templateIdMatchesPrefix('IRSForge:Csa.Csa:Csa', 'IRSForge')).toBe(true)
  })

  it('matches when prefix appears after the package-id boundary', () => {
    const t = 'abc123def456:Daml.Finance.Holding.V4.TransferableFungible:TransferableFungible'
    expect(templateIdMatchesPrefix(t, 'Daml.Finance.Holding')).toBe(true)
    expect(templateIdMatchesPrefix(t, 'Daml.Finance.Settlement')).toBe(false)
  })

  it('does not match mid-module-path', () => {
    const t = 'abc123:Foo.Daml.Finance.Holding:Bar'
    expect(templateIdMatchesPrefix(t, 'Daml.Finance.Holding')).toBe(false)
  })
})

describe('stripPackagePrefix', () => {
  it('strips the package-id when a fully-qualified id is given', () => {
    expect(stripPackagePrefix('abc123:Daml.Finance.Holding.V4.X:Y')).toBe(
      'Daml.Finance.Holding.V4.X:Y',
    )
  })
  it('returns the input unchanged for 2-part or 1-part strings', () => {
    expect(stripPackagePrefix('Module:Entity')).toBe('Module:Entity')
    expect(stripPackagePrefix('nocolon')).toBe('nocolon')
  })
})

describe('shortTemplate', () => {
  it('returns last two colon-segments', () => {
    expect(shortTemplate('pkg:Module.Path:Entity')).toBe('Module.Path:Entity')
  })
  it('returns input unchanged when no colon', () => {
    expect(shortTemplate('nocolon')).toBe('nocolon')
  })
})

describe('kindColorClass', () => {
  it('returns text color by default', () => {
    expect(kindColorClass('create')).toContain('text-green')
    expect(kindColorClass('exercise')).toContain('text-amber')
    expect(kindColorClass('archive')).toContain('text-red')
  })
  it('returns border+bg classes for border-l-bg variant', () => {
    expect(kindColorClass('create', 'border-l-bg')).toContain('border-l-green-500')
  })
})
