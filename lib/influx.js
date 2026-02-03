import { InfluxDB, Point } from '@influxdata/influxdb-client'
import { loadConfig, validateConfig } from './config.js'

let writeApi = null

export async function getWriteApi() {
  if (writeApi) {
    return writeApi
  }

  const config = validateConfig(await loadConfig())
  const client = new InfluxDB({ url: config.url, token: config.token })
  writeApi = client.getWriteApi(config.org, config.bucket, 'ms')

  return writeApi
}

export async function writePoint({ measurement, tags = {}, value, type = 'float', timestamp }) {
  const api = await getWriteApi()

  const point = new Point(measurement)

  // Add tags
  for (const [key, val] of Object.entries(tags)) {
    point.tag(key, val)
  }

  // Add field based on type
  switch (type) {
    case 'float':
      point.floatField('value', value)
      break
    case 'integer':
      point.intField('value', value)
      break
    case 'string':
      point.stringField('value', value)
      break
    case 'boolean':
      point.booleanField('value', value)
      break
    default:
      point.floatField('value', value)
  }

  // Set timestamp
  if (timestamp) {
    point.timestamp(new Date(timestamp))
  }

  api.writePoint(point)
  await api.flush()
}

export async function closeWriteApi() {
  if (writeApi) {
    await writeApi.close()
    writeApi = null
  }
}
