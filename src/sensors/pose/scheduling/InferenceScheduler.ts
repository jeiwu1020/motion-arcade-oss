export interface InferenceSchedulerStats {
  readonly targetHz: number
  readonly completedInferences: number
  readonly droppedInferenceFrames: number
}

interface SchedulerOptions<TFrame, TResult> {
  readonly targetHz: number
  readonly infer: (frame: TFrame, timestampMs: number) => Promise<TResult>
  readonly onResult?: ((result: TResult) => void) | undefined
  readonly onError?: ((error: unknown) => void | Promise<void>) | undefined
}

export class InferenceScheduler<TFrame, TResult> {
  private running = false
  private inFlight = false
  private generation = 0
  private lastOpportunityMs: number | null = null
  private lastVideoTime: number | null = null
  private completedInferences = 0
  private droppedInferenceFrames = 0
  private targetHz: number
  private readonly options: SchedulerOptions<TFrame, TResult>

  constructor(options: SchedulerOptions<TFrame, TResult>) {
    this.options = options
    this.targetHz = options.targetHz
  }

  start(): void {
    this.generation += 1
    this.running = true
    this.inFlight = false
    this.lastOpportunityMs = null
    this.lastVideoTime = null
    this.completedInferences = 0
    this.droppedInferenceFrames = 0
  }

  stop(): void {
    this.generation += 1
    this.running = false
    this.inFlight = false
  }

  setTargetHz(targetHz: number): void {
    if (!Number.isFinite(targetHz) || targetHz <= 0) return
    this.targetHz = targetHz
  }

  async tick(
    nowMs: number,
    videoTime: number,
    createFrame: () => Promise<TFrame>,
  ): Promise<boolean> {
    if (!this.running) return false
    if (this.lastVideoTime === videoTime) return false

    const minimumIntervalMs = 1_000 / this.targetHz
    if (
      this.lastOpportunityMs !== null &&
      nowMs - this.lastOpportunityMs < minimumIntervalMs
    ) {
      return false
    }

    this.lastOpportunityMs = nowMs
    this.lastVideoTime = videoTime
    if (this.inFlight) {
      this.droppedInferenceFrames += 1
      return false
    }

    const generation = this.generation
    this.inFlight = true
    try {
      const frame = await createFrame()
      if (!this.running || generation !== this.generation) {
        this.closeIfPossible(frame)
        return false
      }
      const result = await this.options.infer(frame, nowMs)
      if (this.running && generation === this.generation) {
        this.completedInferences += 1
        this.options.onResult?.(result)
      }
      return true
    } catch (error) {
      if (this.running && generation === this.generation) {
        await this.options.onError?.(error)
      }
      return false
    } finally {
      if (generation === this.generation) this.inFlight = false
    }
  }

  getStats(): InferenceSchedulerStats {
    return {
      targetHz: this.targetHz,
      completedInferences: this.completedInferences,
      droppedInferenceFrames: this.droppedInferenceFrames,
    }
  }

  private closeIfPossible(frame: TFrame): void {
    const close = (frame as { close?: () => void }).close
    if (typeof close === 'function') close.call(frame)
  }
}
