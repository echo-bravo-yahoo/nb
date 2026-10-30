import { validateProvidedTags, parseMultiFieldValue, coerceFieldValues, coerceValue } from './validation.js'

function toFields(defs, values) {
  return defs
    .filter(fd => fd.name in values)
    .map(fd => ({ name: fd.name, type: fd.type, value: values[fd.name] }))
}

// The CLI passes yargs args as `tags` and a "k:v,k:v" string as a multi-field value;
// the web server passes a tag object and a field object.
export function buildPoint(stream, { value, tags = {}, timestamp }) {
  // InfluxDB tags are strings, so arrays and numbers are stringified
  const influxTags = {}
  for (const [key, val] of Object.entries(validateProvidedTags(tags, stream.tags))) {
    influxTags[key] = Array.isArray(val) ? JSON.stringify(val) : String(val)
  }

  // Grafana sums the `value` field of event streams, so an event is stored as value=1
  // beside the stream's event fields, which fall back to their defaults.
  if (stream.type === 'event') {
    const defs = stream.fields ?? []
    const given = value === undefined || value === null || value === '' ? undefined : value
    if (given !== undefined && defs.length === 0) {
      throw new Error(`Stream "${stream.name}" records events, so it takes no value`)
    }
    if (given !== undefined && typeof given !== 'string' && typeof given !== 'object') {
      throw new Error(`Invalid field value "${given}". Expected "name:value"`)
    }
    const eventValues = typeof given === 'string'
      ? parseMultiFieldValue(given, defs, influxTags)
      : coerceFieldValues(given ?? {}, defs, influxTags)
    return {
      measurement: stream.measure,
      tags: influxTags,
      fields: [{ name: 'value', type: 'integer', value: 1 }, ...toFields(defs, eventValues)],
      timestamp
    }
  }

  if (stream.fields) {
    const fieldValues = typeof value === 'string'
      ? parseMultiFieldValue(value, stream.fields)
      : coerceFieldValues(value ?? {}, stream.fields)
    return { measurement: stream.measure, tags: influxTags, fields: toFields(stream.fields, fieldValues), timestamp }
  }

  if (value === undefined || value === null || value === '') throw new Error('Missing value')
  return {
    measurement: stream.measure,
    tags: influxTags,
    value: coerceValue(value, stream.type),
    type: stream.type,
    timestamp
  }
}
