import type {CalculationEvent, MeasurementEvent} from '../types'

/**
 * Type definition for event emission callbacks.
 */
type EventEmitterCallback = (event: CalculationEvent | MeasurementEvent) => void

/** Global collection of emitted calculation and measurement events */
let collectedEvents: (CalculationEvent | MeasurementEvent)[] = []

/** Optional custom event emitter callback */
let customEventEmitter: EventEmitterCallback | null = null

/**
 * Sets a custom event emitter callback for calculation and measurement events.
 *
 * @param emitterCallback - Function to call when events are emitted
 */
export function setEventEmitter(emitterCallback: EventEmitterCallback): void {
  customEventEmitter = emitterCallback
}

/**
 * Returns a copy of all collected calculation and measurement events.
 *
 * @returns Array of all emitted events since last clear
 */
export function getCollectedEvents(): (CalculationEvent | MeasurementEvent)[] {
  return [...collectedEvents]
}

/**
 * Clears all collected events from the internal event collector.
 */
export function clearCollectedEvents(): void {
  collectedEvents = []
}

/**
 * Emits an event to both the internal collector and custom emitter if set.
 *
 * @param event - The calculation or measurement event to emit
 */
function emitEvent(event: CalculationEvent | MeasurementEvent): void {
  collectedEvents.push(event)
  if (customEventEmitter) {
    customEventEmitter(event)
  }
}

/**
 * Executes a calculation function and emits a calculation event for tracking.
 *
 * This function wraps calculation operations to provide event emission for
 * verification tracking and audit trails.
 *
 * @template T - The return type of the calculation function
 * @param inputReference - Reference identifier for the input data
 * @param _inputValue - The actual input value (unused, reserved for future use)
 * @param outputReference - Reference identifier for the output result
 * @param calculationFunctionName - Name/description of the calculation function
 * @param calculationFunction - The actual calculation function to execute
 * @returns The result of the calculation function
 */
export function calculate<T>(
  inputReference: string,
  _inputValue: unknown,
  outputReference: string,
  calculationFunctionName: string,
  calculationFunction: () => T,
): T {
  const calculationResult = calculationFunction()

  const calculationEvent: CalculationEvent = {
    inputRef: inputReference,
    outputRef: outputReference,
    calcFunc: calculationFunctionName,
  }

  emitEvent(calculationEvent)
  return calculationResult
}

/**
 * Executes a measurement function and emits a measurement event for tracking.
 *
 * This function wraps measurement/comparison operations to provide event emission
 * for verification tracking and audit trails.
 *
 * @param expectedValue - The expected value for the measurement
 * @param actualValue - The actual value being measured
 * @param measurementFunction - Function that performs the measurement/comparison
 * @returns The boolean result of the measurement function
 */
export function measure(
  expectedValue: unknown,
  actualValue: unknown,
  measurementFunction: () => boolean,
): boolean {
  const measurementResult = measurementFunction()

  const measurementEvent: MeasurementEvent = {
    passed: measurementResult,
    expected: expectedValue,
    actual: actualValue,
  }

  emitEvent(measurementEvent)
  return measurementResult
}
