import { InfluxDB, Point } from '@influxdata/influxdb-client'
import { loadConfig, validateConfig } from './config.js'

// Each write gets its own WriteApi, because the web server is long-lived: a shared
// one would keep a failed point in its retry buffer and write it after the user had
// already resubmitted. close() flushes, rejects on failure, and drops the buffer.
export async function writePoint({ measurement, tags = {}, value, type = 'float', fields, timestamp }) {
  const config = validateConfig(await loadConfig())
  const api = new InfluxDB({ url: config.url, token: config.token }).getWriteApi(config.org, config.bucket, 'ms')

  const point = new Point(measurement)

  for (const [key, val] of Object.entries(tags)) {
    point.tag(key, val)
  }

  if (fields) {
    // Multi-field mode: fields = [{ name, type, value }]
    for (const { name, type: fieldType, value: fieldValue } of fields) {
      switch (fieldType) {
        case 'float': point.floatField(name, fieldValue); break
        case 'integer': point.intField(name, fieldValue); break
        case 'string': point.stringField(name, String(fieldValue)); break
        case 'boolean': point.booleanField(name, fieldValue); break
        default: point.floatField(name, fieldValue)
      }
    }
  } else {
    switch (type) {
      case 'float': point.floatField('value', value); break
      case 'integer': point.intField('value', value); break
      case 'string': point.stringField('value', value); break
      case 'boolean': point.booleanField('value', value); break
      default: point.floatField('value', value)
    }
  }

  if (timestamp) {
    point.timestamp(new Date(timestamp))
  }

  api.writePoint(point)
  await api.close()
}
