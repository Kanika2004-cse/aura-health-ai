export type MeasurementSystem = 'metric' | 'imperial'

const KEY = 'aura-measurement-system'

export function getMeasurementSystem(): MeasurementSystem {
  return localStorage.getItem(KEY) === 'imperial' ? 'imperial' : 'metric'
}

export function setMeasurementSystem(system: MeasurementSystem) {
  localStorage.setItem(KEY, system)
}

export function displayTemperature(celsius: number, system = getMeasurementSystem()) {
  return system === 'imperial' ? (celsius * 9 / 5) + 32 : celsius
}

export function storedTemperature(value: number, system = getMeasurementSystem()) {
  return system === 'imperial' ? (value - 32) * 5 / 9 : value
}

export function displayHeight(cm: number, system = getMeasurementSystem()) {
  return system === 'imperial' ? cm / 2.54 : cm
}

export function storedHeight(value: number, system = getMeasurementSystem()) {
  return system === 'imperial' ? value * 2.54 : value
}

export function displayWeight(kg: number, system = getMeasurementSystem()) {
  return system === 'imperial' ? kg * 2.2046226218 : kg
}

export function storedWeight(value: number, system = getMeasurementSystem()) {
  return system === 'imperial' ? value / 2.2046226218 : value
}
