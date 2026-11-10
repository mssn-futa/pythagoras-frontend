import { describe, expect, test } from 'vitest'
import {
  ACCEPTANCE_DISCLAIMER, audienceLabel, broadcastStateText, BROADCAST_STATES, canRetryDelivery, DELIVERY_STATES,
  deliveryStateText, formatLagos, isOutstanding, validateForm,
} from '../../src/features/communication/model.js'

const form = (over = {}) => ({ subject: 'Hello', body: 'Body', audienceType: 'all', department: '', level: '', ...over })

describe('state wording', () => {
  test('distinguishes queued, Resend accepted, failed and uncertain', () => {
    expect(deliveryStateText('queued').label).toBe('Queued')
    expect(deliveryStateText('sent').label).toBe('Resend accepted')
    expect(deliveryStateText('failed').label).toBe('Failed (not accepted)')
    expect(deliveryStateText('uncertain').label).toBe('Uncertain')
    expect(broadcastStateText('queued').help).toMatch(/pending/i)
  })

  test('no state label or help claims delivered/inbox/received', () => {
    const texts = [
      ...BROADCAST_STATES.flatMap((s) => [broadcastStateText(s).label, broadcastStateText(s).help]),
      ...DELIVERY_STATES.map((s) => deliveryStateText(s).label),
    ].join(' | ')
    expect(texts).not.toMatch(/deliver(ed|y complete)|inbox|received|read/i)
    expect(ACCEPTANCE_DISCLAIMER).toMatch(/does not confirm/i)
  })

  test('completed help does not claim inbox receipt and points at counts', () => {
    expect(broadcastStateText('completed').help).toBe('Finished with no failed or uncertain messages; see counts.')
  })

  test('unknown states render as-is rather than as sent', () => {
    expect(deliveryStateText('mystery').label).toBe('mystery')
  })
})

describe('retry eligibility', () => {
  test.each([
    ['failed', null, true],
    ['sent', null, false],
    ['uncertain', null, false],
    ['skipped', null, false],
    ['queued', null, false],
    ['cancelled', null, false],
    ['failed', ['retry'], true],
    ['failed', [], false],
    ['sent', ['retry'], false],
  ])('%s with actions %j → %s', (state, eligibleActions, expected) => {
    expect(canRetryDelivery({ state, eligibleActions })).toBe(expected)
  })
})

describe('outstanding work', () => {
  test.each([
    ['draft', false], ['queued', true], ['processing', true],
    ['completed', false], ['completed_with_errors', false], ['uncertain', false],
  ])('%s → %s', (state, expected) => expect(isOutstanding({ state })).toBe(expected))
  test('missing broadcast is not outstanding', () => expect(isOutstanding(null)).toBe(false))
})

describe('form validation', () => {
  test('valid all-students form', () => expect(validateForm(form())).toEqual({}))
  test('requires subject and body', () => {
    expect(Object.keys(validateForm(form({ subject: '  ', body: '' })))).toEqual(['subject', 'body'])
  })
  test('rejects header-injection style subjects and overlong subjects', () => {
    expect(validateForm(form({ subject: 'a\r\nBcc: x' })).subject).toBeTruthy()
    expect(validateForm(form({ subject: 'a'.repeat(201) })).subject).toBeTruthy()
  })
  test('department needs a department; level needs a known level', () => {
    expect(validateForm(form({ audienceType: 'department', department: ' ' })).audience).toBeTruthy()
    expect(validateForm(form({ audienceType: 'department', department: 'Physics' }))).toEqual({})
    expect(validateForm(form({ audienceType: 'level', level: '' })).audience).toBeTruthy()
    expect(validateForm(form({ audienceType: 'level', level: '999' })).audience).toBeTruthy()
    expect(validateForm(form({ audienceType: 'level', level: '300' }))).toEqual({})
  })
  test('an unknown audience blocks saving and is labelled unknown', () => {
    expect(validateForm(form({ audienceType: 'unknown' })).audience[0]).toMatch(/unrecognised audience/)
    expect(audienceLabel({ type: 'unknown' })).toBe('Unknown audience')
  })
  test('audience labels', () => {
    expect(audienceLabel({ type: 'all' })).toBe('All active students')
    expect(audienceLabel({ type: 'department', department: 'Physics' })).toBe('Department: Physics')
    expect(audienceLabel({ type: 'level', level: '300' })).toBe('Level: 300 level')
  })
})

describe('dates', () => {
  test('ISO UTC displays in Africa/Lagos (UTC+1)', () => {
    expect(formatLagos('2026-11-10T23:30:00Z')).toBe('11 Nov 2026, 00:30 (Lagos)')
    expect(formatLagos(null)).toBe('—')
    expect(formatLagos('nonsense')).toBe('—')
  })
})
