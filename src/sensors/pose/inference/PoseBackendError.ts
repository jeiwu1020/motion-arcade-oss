export type PoseBackendErrorCode =
  | 'MODEL_LOAD_FAILED'
  | 'WORKER_INIT_FAILED'
  | 'INFERENCE_FAILED'
  | 'CLOSED'

export class PoseBackendError extends Error {
  readonly code: PoseBackendErrorCode

  constructor(code: PoseBackendErrorCode, message: string) {
    super(message)
    this.name = 'PoseBackendError'
    this.code = code
  }
}
