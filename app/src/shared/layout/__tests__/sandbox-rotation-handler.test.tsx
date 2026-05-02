import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, cleanup, render, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { sandboxRotationBus } from '@/shared/ledger/sandbox-rotation-bus'
import { SandboxRotationHandler } from '../sandbox-rotation-handler'

const remintForRotation = vi.fn(async () => {})
const pingCanary = vi.fn(async () => 1)
let mockHealth: 'idle' | 'live' | 'reconnecting' | 'down' = 'live'

vi.mock('@/shared/contexts/auth-context', () => ({
  useAuth: () => ({ remintForRotation }),
}))
vi.mock('@/shared/hooks/use-ledger-client', () => ({
  useLedgerClient: () => ({
    client: { pingCanary },
    activeParty: 'PartyA',
    partyDisplayName: 'Goldman Sachs',
  }),
}))
vi.mock('@/shared/hooks/use-ledger-health', () => ({
  useLedgerHealth: () => mockHealth,
}))

function renderWithQueryClient() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <SandboxRotationHandler />
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  remintForRotation.mockClear()
  pingCanary.mockClear()
  mockHealth = 'live'
  sandboxRotationBus.resetForTesting()
  sandboxRotationBus.setClockForTesting(() => Date.now())
})

afterEach(() => {
  cleanup()
})

describe('<SandboxRotationHandler />', () => {
  test('renders nothing in idle phase', () => {
    const { container } = renderWithQueryClient()
    expect(container.querySelector('[data-testid="sandbox-rotation-toast"]')).toBeNull()
  })

  test('polls pingCanary on mount', async () => {
    renderWithQueryClient()
    await waitFor(() => {
      expect(pingCanary).toHaveBeenCalled()
    })
  })

  test('on rotation event remints, resets queries, and shows the toast', async () => {
    const { container } = renderWithQueryClient()
    await act(async () => {
      sandboxRotationBus.recordCanaryCount('any-template', 3)
      sandboxRotationBus.recordCanaryCount('any-template', 0)
    })
    await waitFor(() => {
      expect(remintForRotation).toHaveBeenCalledTimes(1)
    })
    await waitFor(() => {
      const toast = container.querySelector('[data-testid="sandbox-rotation-toast"]')
      expect(toast).not.toBeNull()
    })
  })

  test('shows error toast when remint throws', async () => {
    remintForRotation.mockRejectedValueOnce(new Error('network'))
    const consoleErr = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { container } = renderWithQueryClient()
    await act(async () => {
      sandboxRotationBus.recordHealthReconnect()
    })
    await waitFor(() => {
      const toast = container.querySelector('[data-testid="sandbox-rotation-toast"]')
      expect(toast?.textContent ?? '').toMatch(/Could not reconnect/)
    })
    consoleErr.mockRestore()
  })
})
