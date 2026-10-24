// Shaped like ~/.nbrc stream entries.
export const weight = {
  name: 'weight',
  measure: 'weight',
  type: 'float',
  tags: [{ name: 'person', type: 'enum', enumValues: ['ashton', 'madison', 'demi', 'little'] }]
}

export const bp = {
  name: 'bp',
  measure: 'bp',
  tags: [],
  fields: [
    { name: 'systolic', type: 'integer', optional: false },
    { name: 'diastolic', type: 'integer', optional: false },
    { name: 'pulse', type: 'integer', optional: true }
  ]
}
