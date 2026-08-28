export interface RealSensorLabGateEnvironment {
  readonly isDevelopment: boolean
  readonly buildTimeOptIn?: string | undefined
  readonly locationHash?: string | undefined
  readonly queryString?: string | undefined
}

export function isRealSensorLabEnabled({
  isDevelopment,
  buildTimeOptIn,
}: RealSensorLabGateEnvironment): boolean {
  return isDevelopment || buildTimeOptIn === 'true'
}

export const REAL_SENSOR_LAB_ENABLED = isRealSensorLabEnabled({
  isDevelopment: import.meta.env.DEV,
  buildTimeOptIn: import.meta.env.VITE_ENABLE_REAL_SENSOR_LAB,
})
