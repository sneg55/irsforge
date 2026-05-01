import { describe, expect, it } from 'vitest'
import { defaultLandingRoute, ROUTES } from '../routes'

describe('ROUTES', () => {
  const orgId = 'acme'
  it('has static HOME and ORG_SELECTOR', () => {
    expect(ROUTES.HOME).toBe('/')
    expect(ROUTES.ORG_SELECTOR).toBe('/org')
  })

  it('ORG_HOME', () => {
    expect(ROUTES.ORG_HOME(orgId)).toBe('/org/acme')
  })
  it('ORG_LOGIN', () => {
    expect(ROUTES.ORG_LOGIN(orgId)).toBe('/org/acme/login')
  })
  it('ORG_CALLBACK', () => {
    expect(ROUTES.ORG_CALLBACK(orgId)).toBe('/org/acme/callback')
  })
  it('ORG_BLOTTER', () => {
    expect(ROUTES.ORG_BLOTTER(orgId)).toBe('/org/acme/blotter')
  })
  it('ORG_CSA', () => {
    expect(ROUTES.ORG_CSA(orgId)).toBe('/org/acme/csa')
  })
  it('ORG_WORKSPACE', () => {
    expect(ROUTES.ORG_WORKSPACE(orgId)).toBe('/org/acme/workspace')
  })
  it('ORG_WORKSPACE_DRAFT', () => {
    expect(ROUTES.ORG_WORKSPACE_DRAFT(orgId, 'd1')).toBe('/org/acme/workspace?draft=d1')
  })
  it('ORG_WORKSPACE_SWAP', () => {
    expect(ROUTES.ORG_WORKSPACE_SWAP(orgId, 's1')).toBe('/org/acme/workspace?swap=s1')
  })

  it('produces oversight/timeline/csa-board paths for the regulator namespace', () => {
    expect(ROUTES.ORG_OVERSIGHT('regulator')).toBe('/org/regulator/oversight')
    expect(ROUTES.ORG_TIMELINE('regulator')).toBe('/org/regulator/timeline')
    expect(ROUTES.ORG_CSA_BOARD('regulator')).toBe('/org/regulator/csa-board')
  })
})

describe('defaultLandingRoute', () => {
  it("routes role 'operator' to /operator", () => {
    expect(defaultLandingRoute('operator', 'operator')).toBe('/org/operator/operator')
  })

  it("routes role 'regulator' to /oversight", () => {
    expect(defaultLandingRoute('regulator', 'regulator')).toBe('/org/regulator/oversight')
  })

  it("routes role 'trader' to /blotter", () => {
    expect(defaultLandingRoute('goldman', 'trader')).toBe('/org/goldman/blotter')
    expect(defaultLandingRoute('jpmorgan', 'trader')).toBe('/org/jpmorgan/blotter')
  })
})
