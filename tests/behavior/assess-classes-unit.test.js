import { describe, expect, test } from 'vitest'
import { describeClassError } from '../../src/features/assessments/admin/classes/classErrors.js'
import { moveItem, validateClassForm, validateModuleForm } from '../../src/features/assessments/admin/classes/classRules.js'
import {
  buildClassPayload, buildModulePayload, mapClass, mapEnrollment, mapModule, mapResourceRef,
} from '../../src/features/assessments/admin/classes/classService.js'
import { mapQuiz } from '../../src/features/assessments/admin/adminQuizService.js'
import { ApiError } from '../../src/services/api'
import { arabicClass, enrollmentRow, moduleRecord, resourceRef } from '../fixtures/assessClassesApi.js'

describe('class mapping', () => {
  test('maps an Arabic class', () => {
    const mapped = mapClass(arabicClass({ module_count: 3, enrollment_count: 12 }))
    expect(mapped).toMatchObject({ id: 2, code: 'ARB101', status: 'draft', kind: 'arabic', legacy: false, moduleCount: 3, enrollmentCount: 12 })
  })
  test('legacy kind and unknown status fail closed (read-only)', () => {
    expect(mapClass(arabicClass({ kind: 'general' })).legacy).toBe(true)
    const odd = mapClass(arabicClass({ status: 'archived' }))
    expect([odd.status, odd.legacy]).toEqual([null, true])
  })
  test('rejects a non-object body', () => {
    expect(() => mapClass(null)).toThrow(/unexpected response/)
  })
})

describe('module mapping', () => {
  test('keeps hidden attachments so a save never drops them', () => {
    const mapped = mapModule(moduleRecord({ resources: [resourceRef(8, 'Patience')], resource_ids: [8, 19], quizzes: [{ id: 4, title: 'Week 1', status: 'published' }] }))
    expect(mapped.resources.map((r) => r.id)).toEqual([8])
    expect(mapped.hiddenResourceIds).toEqual([19])
    expect(mapped.quizzes).toEqual([{ id: 4, title: 'Week 1', status: 'published' }])
  })
  test('without resource_ids nothing is considered hidden; unknown status is null', () => {
    const mapped = mapModule(moduleRecord({ status: 'weird', resources: [resourceRef(8, 'x')] }))
    expect([mapped.hiddenResourceIds, mapped.status]).toEqual([[], null])
  })
  test('resource refs need an integer id', () => {
    expect(mapResourceRef(resourceRef(8, 'Patience', 'vid'))).toMatchObject({ id: 8, type: 'vid', eventTitle: 'Friday khutbah' })
    expect(() => mapResourceRef({ id: 'x' })).toThrow()
  })
})

describe('roster mapping', () => {
  test('maps status and timestamps; unknown status is null', () => {
    expect(mapEnrollment(enrollmentRow(6, 1, 'Amina Yusuf', 'withdrawn'))).toMatchObject({ id: 6, studentId: 1, status: 'withdrawn', studentName: 'Amina Yusuf' })
    expect(mapEnrollment({ id: 1, status: 'pending' }).status).toBeNull()
  })
})

describe('payloads', () => {
  test('class body is exactly code/title/description, trimmed', () => {
    expect(buildClassPayload({ code: ' ARB101 ', title: ' T ', description: ' d ' })).toEqual({ code: 'ARB101', title: 'T', description: 'd' })
  })
  test('module body is the D3 request shape', () => {
    expect(buildModulePayload({ title: ' Arabic greetings ', body: 'Lesson text', order: 1, resourceIds: [8, 19] })).toEqual({ title: 'Arabic greetings', body: 'Lesson text', order: 1, resource_ids: [8, 19] })
  })
})

describe('rules', () => {
  test('class and module validation', () => {
    expect(validateClassForm({ code: ' ', title: '', description: '' })).toEqual({ code: 'Enter a class code.', title: 'Enter a title.' })
    expect(validateClassForm({ code: 'A', title: 'T', description: '' })).toEqual({})
    expect(Object.keys(validateModuleForm({ title: '', body: '', order: '0' }))).toEqual(['title', 'body', 'order'])
    expect(Object.keys(validateModuleForm({ title: 'a', body: 'b', order: '1.5' }))).toEqual(['order'])
    expect(validateModuleForm({ title: 'a', body: 'b', order: '2' })).toEqual({})
  })
  test('moveItem swaps neighbours and ignores out-of-range moves', () => {
    expect(moveItem(['a', 'b', 'c'], 1, -1)).toEqual(['b', 'a', 'c'])
    expect(moveItem(['a', 'b', 'c'], 2, 1)).toEqual(['a', 'b', 'c'])
  })
})

describe('error mapping', () => {
  test('field errors, conflicts and transport failures', () => {
    const fields = describeClassError(new ApiError({ status: 400, code: 'VALIDATION_ERROR', message: 'Fix.', fields: { code: ['Taken.'] } }), ['code'])
    expect(fields.fields).toEqual({ code: ['Taken.'] })
    const referenced = describeClassError(new ApiError({ status: 409, code: 'RESOURCE_REFERENCED', message: 'Quiz uses it.' }))
    expect(referenced.conflict).toBe(true)
    expect(referenced.message).toMatch(/Unpublish or close it instead\. Quiz uses it\./)
    expect(describeClassError(new ApiError({ status: 409, code: 'CLASS_CLOSED', message: 'Closed.' })).message).toMatch(/conflicts with the current state\. Closed\./)
    expect(describeClassError(new ApiError({ status: 0, code: 'NETWORK_ERROR', message: 'x' })).message).toMatch(/Nothing was saved/)
    expect(describeClassError(new ApiError({ status: 0, code: 'TIMEOUT', message: 'x' })).message).toMatch(/may have been saved/)
    expect(describeClassError(new ApiError({ status: 404, code: 'NOT_FOUND', message: 'x' })).gone).toBe(true)
  })
})

describe('quiz related_course mapping', () => {
  test('integer pk, tolerated {id} object, otherwise null', () => {
    expect(mapQuiz({ id: 1, related_course: 2 }).relatedCourse).toBe(2)
    expect(mapQuiz({ id: 1, related_course: { id: 3 } }).relatedCourse).toBe(3)
    expect(mapQuiz({ id: 1, related_course: null }).relatedCourse).toBeNull()
  })
})
