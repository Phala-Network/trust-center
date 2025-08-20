/**
 * Types for calculation and measurement operations with event emission.
 */

export interface CalculationEvent {
  inputRef: string
  outputRef: string
  calcFunc: string
}

export interface MeasurementEvent {
  passed: boolean
  expected: unknown
  actual: unknown
}
