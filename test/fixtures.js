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

export const habit = {
  name: 'habit',
  measure: 'habit',
  type: 'event',
  tags: [{ name: 'item', type: 'enum', enumValues: ['oats', 'metamucil', 'sterols', 'nuts'] }],
  fields: [
    { name: 'dose_g', type: 'float', optional: true, defaults: { item: { metamucil: 10 } } }
  ]
}

export const eczema = {
  name: 'eczema',
  measure: 'eczema',
  type: 'event',
  tags: []
}

export const demiMed = {
  name: 'demi_med',
  measure: 'demi_med',
  type: 'event',
  tags: [],
  fields: [
    { name: 'dose_ml', type: 'float', optional: false, default: 0.2 }
  ]
}
