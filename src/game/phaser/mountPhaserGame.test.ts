import { describe, expect, it, vi } from 'vitest'

import { mountPhaserGame } from './mountPhaserGame'

describe('mountPhaserGame', () => {
  it('creates the game for the requested parent and destroys its canvas once', () => {
    const parent = {} as HTMLElement
    const destroy = vi.fn()
    const factory = vi.fn(() => ({ destroy }))

    const unmount = mountPhaserGame(parent, factory)
    unmount()
    unmount()

    expect(factory).toHaveBeenCalledOnce()
    expect(factory).toHaveBeenCalledWith(parent)
    expect(destroy).toHaveBeenCalledOnce()
    expect(destroy).toHaveBeenCalledWith(true)
  })
})
