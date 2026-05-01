import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, test, vi } from 'vitest'

vi.mock('../../hooks/use-operator-queue', () => ({
  useOperatorQueue: () => ({ items: [], isLoading: true }),
}))

// canton-party-directory fallback — PartyName may be referenced inside QueueRow
vi.mock('canton-party-directory/ui', () => ({
  PartyName: ({ identifier }: { identifier: string }) => <span>{identifier}</span>,
}))

import { LifecycleQueueCard } from '../lifecycle-queue-card'

afterEach(() => cleanup())

describe('LifecycleQueueCard', () => {
  test('renders skeleton rows while loading, no spinner', () => {
    const { container } = render(<LifecycleQueueCard />)
    const skeletons = container.querySelectorAll('[data-slot="skeleton"]')
    const spinner = container.querySelector('.animate-spin')
    expect(skeletons.length).toBeGreaterThanOrEqual(3)
    expect(spinner).toBeNull()
  })
})
