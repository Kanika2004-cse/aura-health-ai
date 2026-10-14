import { describe, expect, it } from 'vitest'
import { clampPercent, formatGreeting } from '../src/utils/format'

describe('formatGreeting', () => {
  it('returns morning before noon', () => {
    expect(formatGreeting(new Date('2026-09-18T09:00:00'))).toBe('Good morning')
  })
})

describe('clampPercent', () => {
  it('keeps values inside 0–100', () => {
    expect(clampPercent(-4)).toBe(0)
    expect(clampPercent(140)).toBe(100)
    expect(clampPercent(84)).toBe(84)
  })
})
