export interface TestModeGateEnvironment {
  readonly isDevelopment: boolean
  readonly buildTimeOptIn?: string | undefined
  readonly queryString?: string | undefined
}

export function isTestInputEnabled({
  isDevelopment,
  buildTimeOptIn,
}: TestModeGateEnvironment): boolean {
  return isDevelopment || buildTimeOptIn === 'true'
}

export const TEST_INPUT_ENABLED = isTestInputEnabled({
  isDevelopment: import.meta.env.DEV,
  buildTimeOptIn: import.meta.env.VITE_ENABLE_TEST_INPUT,
})
