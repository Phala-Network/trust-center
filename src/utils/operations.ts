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
 * Also hooks into DataObject generation for visualization.
 *
 * @param event - The calculation or measurement event to emit
 */
function emitEvent(event: CalculationEvent | MeasurementEvent): void {
  collectedEvents.push(event)
  if (customEventEmitter) {
    customEventEmitter(event)
  }

  // Hook into DataObject generation
  hookDataObjectGeneration(event)
}

/**
 * Hook function that processes calculation and measurement events
 * to generate or update DataObjects for visualization
 */
function hookDataObjectGeneration(
  event: CalculationEvent | MeasurementEvent,
): void {
  // This will be extended by verifiers to create specific DataObjects
  // For now, we just ensure the hook is in place
}

/**
 * Executes a calculation function and emits a calculation event for tracking.
 *
 * This function wraps calculation operations to provide event emission for
 * verification tracking and audit trails, and hooks into DataObject generation.
 *
 * @template T - The return type of the calculation function
 * @param inputReference - Reference identifier for the input data
 * @param inputValue - The actual input value
 * @param outputReference - Reference identifier for the output result
 * @param calculationFunctionName - Name/description of the calculation function
 * @param calculationFunction - The actual calculation function to execute
 * @param objectId - Optional DataObject ID to associate this calculation with
 * @returns The result of the calculation function
 */
export function calculate<T>(
  inputReference: string,
  inputValue: unknown,
  outputReference: string,
  calculationFunctionName: string,
  calculationFunction: () => T,
  objectId?: string,
): T {
  const calculationResult = calculationFunction()

  const calculationEvent: CalculationEvent = {
    inputRef: inputReference,
    outputRef: outputReference,
    calcFunc: calculationFunctionName,
  }

  // Store additional context for DataObject generation
  if (objectId) {
    ;(calculationEvent as any).objectId = objectId
    ;(calculationEvent as any).inputValue = inputValue
    ;(calculationEvent as any).outputValue = calculationResult
  }

  emitEvent(calculationEvent)
  return calculationResult
}

/**
 * Executes a measurement function and emits a measurement event for tracking.
 *
 * This function wraps measurement/comparison operations to provide event emission
 * for verification tracking and audit trails, and hooks into DataObject generation.
 *
 * @param expectedValue - The expected value for the measurement
 * @param actualValue - The actual value being measured
 * @param measurementFunction - Function that performs the measurement/comparison
 * @param objectId - Optional DataObject ID to associate this measurement with
 * @param fieldName - Optional field name being measured
 * @returns The boolean result of the measurement function
 */
export function measure(
  expectedValue: unknown,
  actualValue: unknown,
  measurementFunction: () => boolean,
  objectId?: string,
  fieldName?: string,
): boolean {
  const measurementResult = measurementFunction()

  const measurementEvent: MeasurementEvent = {
    passed: measurementResult,
    expected: expectedValue,
    actual: actualValue,
  }

  // Store additional context for DataObject generation
  if (objectId) {
    ;(measurementEvent as any).objectId = objectId
    ;(measurementEvent as any).fieldName = fieldName
  }

  emitEvent(measurementEvent)
  return measurementResult
}
