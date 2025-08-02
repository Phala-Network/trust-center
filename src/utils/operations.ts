import type {CalculationEvent, MeasurementEvent} from '../types'

type EventEmitter = (event: CalculationEvent | MeasurementEvent) => void

let eventCollector: (CalculationEvent | MeasurementEvent)[] = []
let customEmitter: EventEmitter | null = null

export function setEventEmitter(emitter: EventEmitter): void {
  customEmitter = emitter
}

export function getCollectedEvents(): (CalculationEvent | MeasurementEvent)[] {
  return [...eventCollector]
}

export function clearCollectedEvents(): void {
  eventCollector = []
}

function emitEvent(event: CalculationEvent | MeasurementEvent): void {
  eventCollector.push(event)
  if (customEmitter) {
    customEmitter(event)
  }
}

export function calculate<T>(
  inputRef: string,
  inputValue: unknown,
  outputRef: string,
  calcFunc: string,
  calculationFn: () => T,
): T {
  const result = calculationFn()

  const event: CalculationEvent = {
    inputRef,
    outputRef,
    calcFunc,
  }

  emitEvent(event)
  return result
}

export function measure(
  expected: unknown,
  actual: unknown,
  measurementFn: () => boolean,
): boolean {
  const result = measurementFn()

  const event: MeasurementEvent = {
    passed: result,
    expected,
    actual,
  }

  emitEvent(event)
  return result
}
