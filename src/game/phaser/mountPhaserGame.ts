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
