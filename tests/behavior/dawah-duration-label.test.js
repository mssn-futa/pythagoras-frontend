import { describe, expect, test } from 'vitest'
import { formatDurationLabel } from '../../src/features/dawah/public/lib/format.js'

describe('formatDurationLabel', () => {
  test('uses seconds precision', () => {
    expect(formatDurationLabel(2)).toBe('0:02')
    expect(formatDurationLabel(125)).toBe('2:05')
    expect(formatDurationLabel(3725)).toBe('1:02:05')
  })
  test('hides unknown or zero durations', () => {
    expect(formatDurationLabel(0)).toBe('')
    expect(formatDurationLabel(null)).toBe('')
  })
})
