import { test } from 'node:test'
import assert from 'node:assert/strict'

import { buildPoint } from '../lib/note.js'
import { weight, bp, habit, eczema, demiMed } from './fixtures.js'

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

const ONE = { name: 'value', type: 'integer', value: 1 }

test('builds an event point as value=1', () => {
  assert.deepEqual(
    buildPoint(eczema, { timestamp: 1000 }),
    { measurement: 'eczema', tags: {}, fields: [ONE], timestamp: 1000 }
  )
})

test('rejects a value on an event stream without event fields', () => {
  assert.throws(() => buildPoint(eczema, { value: '1' }), /takes no value/)
  assert.throws(() => buildPoint(eczema, { value: '3' }), /takes no value/)
})

test('writes an event field only when it has a value or a default', () => {
  assert.deepEqual(buildPoint(habit, { tags: { item: 'oats' }, timestamp: 1000 }).fields, [ONE])
  assert.deepEqual(buildPoint(habit, { tags: { item: 'metamucil' }, timestamp: 1000 }).fields, [
    ONE,
    { name: 'dose_g', type: 'float', value: 10 }
  ])
})

test('overrides an event field default from a string or an object', () => {
  for (const item of ['metamucil', 'oats']) {
    for (const value of ['dose_g:12', { dose_g: '12' }]) {
      assert.deepEqual(buildPoint(habit, { value, tags: { item }, timestamp: 1000 }).fields, [
        ONE,
        { name: 'dose_g', type: 'float', value: 12 }
      ])
    }
  }
})

test('validates the tags of an event stream', () => {
  assert.throws(() => buildPoint(habit, { tags: { item: 'bob' } }), /must be one of/)
  assert.throws(() => buildPoint(habit, { tags: {} }), /Missing required tag/)
})

test('uses the plain default of an event field', () => {
  assert.deepEqual(buildPoint(demiMed, { timestamp: 1000 }).fields, [
    ONE,
    { name: 'dose_ml', type: 'float', value: 0.2 }
  ])
  assert.deepEqual(buildPoint(demiMed, { value: 'dose_ml:0.3' }).fields, [
    ONE,
    { name: 'dose_ml', type: 'float', value: 0.3 }
  ])
})

test('rejects a bare or unknown value on an event stream with event fields', () => {
  assert.throws(() => buildPoint(demiMed, { value: '1' }), /Expected "name:value"/)
  assert.throws(() => buildPoint(demiMed, { value: 'dose:5' }), /Unknown field/)
})
