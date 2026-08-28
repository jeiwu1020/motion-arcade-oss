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

  it('does not create a game when a lazy mount is cancelled before loading', async () => {
    const parent = {} as HTMLElement
    const destroy = vi.fn()
    let resolveFactory: ((factory: () => { destroy: typeof destroy }) => void) | undefined
    const factoryPromise = new Promise<() => { destroy: typeof destroy }>(
      (resolve) => {
        resolveFactory = resolve
      },
    )

    const mount = mountPhaserGame.lazy(parent, factoryPromise)
    mount.unmount()
    resolveFactory?.(() => ({ destroy }))
    await mount.ready

    expect(destroy).not.toHaveBeenCalled()
  })

  it('destroys a resolved lazy game exactly once under repeated cleanup', async () => {
    const destroy = vi.fn()
    const mount = mountPhaserGame.lazy(
      {} as HTMLElement,
      Promise.resolve(() => ({ destroy })),
    )
    await mount.ready

    mount.unmount()
    mount.unmount()

    expect(destroy).toHaveBeenCalledOnce()
    expect(destroy).toHaveBeenCalledWith(true)
  })
})
