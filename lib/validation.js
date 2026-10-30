export const VALID_FIELD_TYPES = ['string', 'number', 'enum', 'array']

export function parseTagDefinition(str) {
  // Format: "name,type[,enumValue1,enumValue2,...]" or "name,array,elementType"
  const parts = str.split(',').map(p => p.trim())

  if (parts.length < 2) {
    throw new Error(`Invalid tag definition "${str}". Expected "name,type" or "name,type,options..."`)
  }

  const [name, type, ...rest] = parts

  if (!name) {
    throw new Error(`Tag name cannot be empty in "${str}"`)
  }

  if (!VALID_FIELD_TYPES.includes(type)) {
    throw new Error(`Invalid type "${type}" in tag "${name}". Valid types: ${VALID_FIELD_TYPES.join(', ')}`)
  }

  const tag = { name, type }

  if (type === 'enum') {
    if (rest.length === 0) {
      throw new Error(`Enum tag "${name}" requires at least one allowed value`)
    }
    tag.enumValues = rest
  } else if (type === 'array') {
    if (rest.length !== 1) {
      throw new Error(`Array tag "${name}" requires exactly one element type (string or number)`)
    }
    const elementType = rest[0]
    if (!['string', 'number'].includes(elementType)) {
      throw new Error(`Array element type must be "string" or "number", got "${elementType}"`)
    }
    tag.elementType = elementType
  }

  return tag
}

export function validateTagValue(value, tagDef) {
  const { name, type, enumValues, elementType } = tagDef

  switch (type) {
    case 'string':
      return String(value)

    case 'number': {
      const num = parseFloat(value)
      if (isNaN(num)) {
        throw new Error(`Tag "${name}" expects a number, got "${value}"`)
      }
      return num
    }

    case 'enum':
      if (!enumValues.includes(value)) {
        throw new Error(`Tag "${name}" must be one of: ${enumValues.join(', ')}. Got "${value}"`)
      }
      return value

    case 'array':
      // Value should already be an array from yargs (multiple --tag uses)
      const arr = Array.isArray(value) ? value : [value]
      return arr.map((v, i) => {
        if (elementType === 'number') {
          const num = parseFloat(v)
          if (isNaN(num)) {
            throw new Error(`Tag "${name}[${i}]" expects a number, got "${v}"`)
          }
          return num
        }
        return String(v)
      })

    default:
      return String(value)
  }
}

export function validateProvidedTags(args, tagDefs) {
  const result = {}
  const knownOptions = ['stream', 's', 'time', 't', 'help', 'version', '_', '$0', 'value']

  // Check all required tags are provided
  for (const tagDef of tagDefs) {
    const value = args[tagDef.name]

    if (value === undefined) {
      throw new Error(`Missing required tag: --${tagDef.name}`)
    }

    result[tagDef.name] = validateTagValue(value, tagDef)
  }

  // Check for unknown tags
  for (const key of Object.keys(args)) {
    if (knownOptions.includes(key)) continue
    const tagDef = tagDefs.find(t => t.name === key)
    if (!tagDef) {
      throw new Error(`Unknown tag: --${key}`)
    }
  }

  return result
}

// Field definitions for multi-field streams
export function parseFieldDefinition(str) {
  // Format: "name[?]:type[=default]" (? = optional)
  const colonIdx = str.indexOf(':')
  if (colonIdx === -1) {
    throw new Error(`Invalid field definition "${str}". Expected "name:type" or "name?:type"`)
  }
  let name = str.slice(0, colonIdx).trim()
  const [type, defaultText] = splitOnce(str.slice(colonIdx + 1), '=')
  const optional = name.endsWith('?')
  if (optional) name = name.slice(0, -1)
  if (!name) throw new Error(`Field name cannot be empty in "${str}"`)
  if (!VALID_VALUE_TYPES.includes(type)) {
    throw new Error(`Invalid field type "${type}" in "${str}". Valid types: ${VALID_VALUE_TYPES.join(', ')}`)
  }
  return defaultText === undefined
    ? { name, type, optional }
    : { name, type, optional, default: coerceValue(defaultText, type) }
}

function splitOnce(text, separator) {
  const idx = text.indexOf(separator)
  return idx === -1
    ? [text.trim()]
    : [text.slice(0, idx).trim(), text.slice(idx + 1).trim()]
}

export function parseMultiFieldValue(valueStr, fieldDefs, tags = {}) {
  // Parse "key:val,key:val,..." respecting that values are simple scalars
  const provided = {}
  for (const part of valueStr.split(',')) {
    const colonIdx = part.indexOf(':')
    if (colonIdx === -1) throw new Error(`Invalid field value "${part}". Expected "name:value"`)
    provided[part.slice(0, colonIdx).trim()] = part.slice(colonIdx + 1).trim()
  }
  return coerceFieldValues(provided, fieldDefs, tags)
}

// A field's `defaults` maps a tag name to { tagValue: default }; `default` applies when no tag matches.
export function defaultFor(fieldDef, tags) {
  for (const [tag, byValue] of Object.entries(fieldDef.defaults ?? {})) {
    if (tags[tag] !== undefined && Object.hasOwn(byValue, tags[tag])) {
      return byValue[tags[tag]]
    }
  }
  return fieldDef.default
}

export function coerceFieldValues(provided, fieldDefs, tags = {}) {
  const fieldDefMap = Object.fromEntries(fieldDefs.map(f => [f.name, f]))
  for (const key of Object.keys(provided)) {
    if (!fieldDefMap[key]) {
      throw new Error(`Unknown field: "${key}". Declared fields: ${fieldDefs.map(f => f.name).join(', ')}`)
    }
  }

  const result = {}
  for (const fieldDef of fieldDefs) {
    const raw = provided[fieldDef.name] ?? defaultFor(fieldDef, tags)
    if (raw === undefined) {
      if (!fieldDef.optional) throw new Error(`Missing required field: "${fieldDef.name}"`)
      continue
    }
    result[fieldDef.name] = coerceValue(raw, fieldDef.type)
  }
  return result
}

// Value type validation for the main measurement value
export const VALID_VALUE_TYPES = ['float', 'integer', 'string', 'boolean']

// `event` is a stream type, not a value type: buildPoint stores it as value=1,
// and parseFieldDefinition keeps checking field types against VALID_VALUE_TYPES.
export const STREAM_TYPES = [...VALID_VALUE_TYPES, 'event']

export function validateStreamType(type) {
  if (!STREAM_TYPES.includes(type)) {
    throw new Error(`Invalid stream type "${type}". Valid types: ${STREAM_TYPES.join(', ')}`)
  }
  return type
}

export function coerceValue(value, type) {
  switch (type) {
    case 'float': {
      const num = parseFloat(value)
      if (isNaN(num)) {
        throw new Error(`Cannot convert "${value}" to float`)
      }
      return num
    }
    case 'integer': {
      const num = parseInt(value, 10)
      if (isNaN(num)) {
        throw new Error(`Cannot convert "${value}" to integer`)
      }
      return num
    }
    case 'boolean': {
      const lower = String(value).toLowerCase()
      if (lower === 'true' || lower === '1' || lower === 'yes') {
        return true
      }
      if (lower === 'false' || lower === '0' || lower === 'no') {
        return false
      }
      throw new Error(`Cannot convert "${value}" to boolean. Use true/false, 1/0, or yes/no`)
    }
    case 'string':
    default:
      return String(value)
  }
}
