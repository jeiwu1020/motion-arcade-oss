/**
 * Shared limits for the explicit production Pose startup path. These bounds
 * convert unavailable browser/media/model work into retryable failures; they
 * never initiate acquisition themselves.
 */
export interface PoseStartupTimeoutPolicy {
  readonly cameraPermissionMs: number
  readonly cameraPreviewMs: number
  readonly workerInitializationMs: number
  readonly mainThreadInitializationMs: number
  readonly workerCloseMs: number
}

export const POSE_STARTUP_TIMEOUTS: PoseStartupTimeoutPolicy = Object.freeze({
  cameraPermissionMs: 20_000,
  cameraPreviewMs: 8_000,
  workerInitializationMs: 12_000,
  mainThreadInitializationMs: 12_000,
  workerCloseMs: 1_000,
})

export function withStartupTimeout<T, E extends Error>(
  operation: Promise<T>,
  timeoutMs: number,
  createTimeoutError: () => E,
  onTimeout?: () => void,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    let settled = false
    const timeoutId = setTimeout(() => {
      if (settled) return
      settled = true
      onTimeout?.()
      reject(createTimeoutError())
    }, timeoutMs)

    operation.then(
      (value) => {
        if (settled) return
        settled = true
        clearTimeout(timeoutId)
        resolve(value)
      },
      (error: unknown) => {
        if (settled) return
        settled = true
        clearTimeout(timeoutId)
        reject(error)
      },
    )
  })
}
