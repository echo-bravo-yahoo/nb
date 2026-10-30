import { test } from 'node:test'
import assert from 'node:assert/strict'

import { parseFieldDefinition } from '../lib/validation.js'

test('parses a field definition with a default', () => {
  assert.deepEqual(
    parseFieldDefinition('dose_ml:float=0.2'),
    { name: 'dose_ml', type: 'float', optional: false, default: 0.2 }
  )
})

test('rejects a field default that does not convert to the field type', () => {
  assert.throws(() => parseFieldDefinition('dose_ml:float=abc'), /Cannot convert/)
})
