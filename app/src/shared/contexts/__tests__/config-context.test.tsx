import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, test, vi } from 'vitest'
import { clientConfigSchema, loadClientConfig } from '../../config/client'
import { ConfigProvider, useConfig } from '../config-context'

vi.mock('../../config/client', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...(actual as object),
    loadClientConfig: vi.fn(),
  }
})

const mockLoad = loadClientConfig as unknown as ReturnType<typeof vi.fn>

beforeEach(() => {
  mockLoad.mockReset()
})

describe('ConfigProvider', () => {
  test('loading=true then loading=false with config after resolve', async () => {
    const cfg = {
      orgs: [{ id: 'a', party: 'PA', displayName: 'A', hint: 'PA', ledgerUrl: 'http://x' }],
    } as unknown as Awaited<ReturnType<typeof loadClientConfig>>
    mockLoad.mockResolvedValueOnce(cfg)

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <ConfigProvider>{children}</ConfigProvider>
    )
    const { result } = renderHook(() => useConfig(), { wrapper })
    expect(result.current.loading).toBe(true)
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.config).toBe(cfg)
    expect(result.current.getOrg('a')?.id).toBe('a')
    expect(result.current.getOrg('zzz')).toBeUndefined()
  })

  test('error during load: config stays null but loading ends', async () => {
    mockLoad.mockRejectedValueOnce(new Error('boom'))
    const err = vi.spyOn(console, 'error').mockImplementation(() => {})

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <ConfigProvider>{children}</ConfigProvider>
    )
    const { result } = renderHook(() => useConfig(), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.config).toBeNull()
    expect(result.current.getOrg('a')).toBeUndefined()
    err.mockRestore()
  })

  test('default context values when not in provider', () => {
    const { result } = renderHook(() => useConfig())
    expect(result.current.config).toBeNull()
    expect(result.current.loading).toBe(true)
    expect(result.current.getOrg('x')).toBeUndefined()
  })
})

describe('clientConfigSchema', () => {
  it('accepts a config with platform.ledgerUi', () => {
    const parsed = clientConfigSchema.safeParse({
      profile: 'demo',
      topology: 'sandbox',
      routing: 'path',
      auth: { provider: 'demo' },
      daml: { ledgerId: 'x', applicationId: 'y' },
      orgs: [
        { id: 'o', party: 'p', displayName: 'P', hint: 'H', role: 'trader', ledgerUrl: 'http://x' },
      ],
      ledgerUi: {
        enabled: true,
        bufferSize: 500,
        templateFilter: { allow: [], deny: [], systemPrefixes: [] },
        toasts: { enabled: true, maxVisible: 3, dismissAfterMs: 5000 },
        rawPayload: { enabled: true },
      },
    })
    expect(parsed.success).toBe(true)
    if (parsed.success) {
      expect(parsed.data.ledgerUi?.enabled).toBe(true)
    }
  })

  it('accepts a config without ledgerUi (optional)', () => {
    const parsed = clientConfigSchema.safeParse({
      profile: 'demo',
      topology: 'sandbox',
      routing: 'path',
      auth: { provider: 'demo' },
      daml: { ledgerId: 'x', applicationId: 'y' },
      orgs: [
        { id: 'o', party: 'p', displayName: 'P', hint: 'H', role: 'trader', ledgerUrl: 'http://x' },
      ],
    })
    expect(parsed.success).toBe(true)
  })
})
