import { test } from 'node:test'
import assert from 'node:assert/strict'

import { buildPoint } from '../lib/note.js'
import { weight, bp } from './fixtures.js'

test('builds a single-field point', () => {
  assert.deepEqual(
    buildPoint(weight, { value: '17.74', tags: { person: 'little' }, timestamp: 1000 }),
    { measurement: 'weight', tags: { person: 'little' }, value: 17.74, type: 'float', timestamp: 1000 }
  )
})

test('rejects an enum tag value outside the stream definition', () => {
  assert.throws(() => buildPoint(weight, { value: '17.74', tags: { person: 'bob' } }), /must be one of/)
})

test('rejects a missing tag', () => {
  assert.throws(() => buildPoint(weight, { value: '17.74', tags: {} }), /Missing required tag/)
})

test('builds the same multi-field point from a string or an object', () => {
  const fromString = buildPoint(bp, { value: 'systolic:116,diastolic:64', timestamp: 1000 })
  const fromObject = buildPoint(bp, { value: { systolic: '116', diastolic: '64' }, timestamp: 1000 })
  assert.deepEqual(fromString, fromObject)
  assert.deepEqual(fromObject.fields, [
    { name: 'systolic', type: 'integer', value: 116 },
    { name: 'diastolic', type: 'integer', value: 64 }
  ])
})

test('rejects a multi-field value without a required field', () => {
  assert.throws(() => buildPoint(bp, { value: 'systolic:116' }), /Missing required field/)
  assert.throws(() => buildPoint(bp, { value: { systolic: '116' } }), /Missing required field/)
})

test('rejects a single-field note without a value', () => {
  assert.throws(() => buildPoint(weight, { value: '', tags: { person: 'little' } }), /Missing value/)
  assert.throws(() => buildPoint(weight, { tags: { person: 'little' } }), /Missing value/)
})
