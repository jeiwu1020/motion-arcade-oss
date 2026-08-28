export interface PhaserGameHandle {
  destroy(removeCanvas: boolean): void
}

export type PhaserGameFactory = (parent: HTMLElement) => PhaserGameHandle

export function mountPhaserGame(
  parent: HTMLElement,
  factory: PhaserGameFactory,
): () => void {
  const game = factory(parent)
  let isUnmounted = false

  return () => {
    if (isUnmounted) return

    isUnmounted = true
    game.destroy(true)
  }
}

interface LazyPhaserMount {
  readonly ready: Promise<void>
  unmount(): void
}

async function resolveLazyMount(
  parent: HTMLElement,
  factoryPromise: Promise<PhaserGameFactory>,
  state: { cancelled: boolean; cleanup?: () => void },
): Promise<void> {
  const factory = await factoryPromise
  if (state.cancelled) return
  state.cleanup = mountPhaserGame(parent, factory)
}

mountPhaserGame.lazy = function lazyMountPhaserGame(
  parent: HTMLElement,
  factoryPromise: Promise<PhaserGameFactory>,
): LazyPhaserMount {
  const state: { cancelled: boolean; cleanup?: () => void } = {
    cancelled: false,
  }
  const ready = resolveLazyMount(parent, factoryPromise, state)

  return {
    ready,
    unmount() {
      if (state.cancelled) return
      state.cancelled = true
      state.cleanup?.()
    },
  }
}
