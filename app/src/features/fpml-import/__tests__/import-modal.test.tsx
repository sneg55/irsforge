import fs from 'node:fs'
import path from 'node:path'
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ImportFpmlModal } from '../import-modal'

const pushSpy = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushSpy, replace: vi.fn() }),
}))

const loadFixture = (name: string): string =>
  fs.readFileSync(path.join(__dirname, 'fixtures', name), 'utf-8')

describe('ImportFpmlModal', () => {
  beforeEach(() => pushSpy.mockReset())

  it('Import button navigates to workspace with ?type=IRS&import=<json>', () => {
    const onClose = vi.fn()
    render(<ImportFpmlModal workspaceBase="/org/goldman/workspace" onClose={onClose} />)

    fireEvent.change(screen.getByRole('textbox'), { target: { value: loadFixture('irs.xml') } })
    fireEvent.click(screen.getByRole('button', { name: /^import$/i }))

    expect(pushSpy).toHaveBeenCalledTimes(1)
    const url: string = pushSpy.mock.calls[0][0]
    expect(url).toMatch(/^\/org\/goldman\/workspace\?/)
    expect(url).toContain('type=IRS')
    expect(url).toContain('import=')
    expect(onClose).toHaveBeenCalled()
  })

  it('OIS fixture routes via ?type=OIS', () => {
    const onClose = vi.fn()
    render(<ImportFpmlModal workspaceBase="/org/goldman/workspace" onClose={onClose} />)

    fireEvent.change(screen.getByRole('textbox'), { target: { value: loadFixture('ois.xml') } })
    fireEvent.click(screen.getByRole('button', { name: /^import$/i }))

    expect(pushSpy).toHaveBeenCalledTimes(1)
    expect(pushSpy.mock.calls[0][0]).toContain('type=OIS')
  })

  it('unsupported XML surfaces the classifier reason and keeps modal open', () => {
    const onClose = vi.fn()
    render(<ImportFpmlModal workspaceBase="/org/goldman/workspace" onClose={onClose} />)

    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: loadFixture('unsupported.xml') },
    })
    fireEvent.click(screen.getByRole('button', { name: /^import$/i }))

    expect(pushSpy).not.toHaveBeenCalled()
    expect(onClose).not.toHaveBeenCalled()
    const alert = screen.getByRole('alert')
    expect(alert.textContent?.toLowerCase() ?? '').toMatch(/stream count/i)
  })

  it('Import button disabled when textarea is empty', () => {
    render(<ImportFpmlModal workspaceBase="/org/goldman/workspace" onClose={vi.fn()} />)
    const button = screen.getByRole('button', { name: /^import$/i }) as HTMLButtonElement
    expect(button.disabled).toBe(true)
  })
})
