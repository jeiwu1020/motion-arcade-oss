import type {
  MotionInputProvider,
  MotionInputRequest,
} from '../contracts/motion'

export class MotionProviderCoordinator {
  #current: MotionInputProvider | undefined

  async switchTo(
    provider: MotionInputProvider,
    request: MotionInputRequest,
  ): Promise<void> {
    if (this.#current && this.#current !== provider) {
      await this.#current.stop()
    }
    this.#current = provider
    await provider.start(request)
  }

  async stop(): Promise<void> {
    const current = this.#current
    this.#current = undefined
    await current?.stop()
  }

  getCurrent(): MotionInputProvider | undefined {
    return this.#current
  }
}
