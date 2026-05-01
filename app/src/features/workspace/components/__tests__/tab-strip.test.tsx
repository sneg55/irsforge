import { cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { type TabDef, type TabKey, TabStrip } from '../tab-strip'

afterEach(() => cleanup())

const TABS: TabDef[] = [
  { key: 'valuation', label: 'Valuation' },
  { key: 'risk', label: 'Risk' },
  { key: 'solver', label: 'Solver' },
]

describe('TabStrip', () => {
  test('renders one tab button per def', () => {
    const { container } = render(
      <TabStrip tabs={TABS} active="valuation" onChange={vi.fn()}>
        body
      </TabStrip>,
    )
    const buttons = container.querySelectorAll('[role="tab"]')
    expect(buttons).toHaveLength(3)
  })

  test('marks the active tab with aria-selected=true', () => {
    const { container } = render(
      <TabStrip tabs={TABS} active="risk" onChange={vi.fn()}>
        body
      </TabStrip>,
    )
    const active = container.querySelector('[aria-selected="true"]')
    expect(active!.textContent).toBe('Risk')
  })

  test('clicking a tab fires onChange with its key', () => {
    const onChange = vi.fn<(k: TabKey) => void>()
    const { container } = render(
      <TabStrip tabs={TABS} active="valuation" onChange={onChange}>
        body
      </TabStrip>,
    )
    const buttons = container.querySelectorAll('[role="tab"]')
    fireEvent.click(buttons[2])
    expect(onChange).toHaveBeenCalledWith('solver')
  })

  test('renders the children inside the tab panel', () => {
    const { container } = render(
      <TabStrip tabs={TABS} active="valuation" onChange={vi.fn()}>
        <div data-testid="body">hello</div>
      </TabStrip>,
    )
    const panel = container.querySelector('[role="tabpanel"]')
    expect(panel!.querySelector('[data-testid="body"]')!.textContent).toBe('hello')
  })
})
