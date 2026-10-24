import { validateProvidedTags, parseMultiFieldValue, coerceFieldValues, coerceValue } from './validation.js'

// The CLI passes yargs args as `tags` and a "k:v,k:v" string as a multi-field value;
// the web server passes a tag object and a field object.
export function buildPoint(stream, { value, tags = {}, timestamp }) {
  // InfluxDB tags are strings, so arrays and numbers are stringified
  const influxTags = {}
  for (const [key, val] of Object.entries(validateProvidedTags(tags, stream.tags))) {
    influxTags[key] = Array.isArray(val) ? JSON.stringify(val) : String(val)
  }

  if (stream.fields) {
    const fieldValues = typeof value === 'string'
      ? parseMultiFieldValue(value, stream.fields)
      : coerceFieldValues(value ?? {}, stream.fields)
    const fields = stream.fields
      .filter(fd => fd.name in fieldValues)
      .map(fd => ({ name: fd.name, type: fd.type, value: fieldValues[fd.name] }))
    return { measurement: stream.measure, tags: influxTags, fields, timestamp }
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
