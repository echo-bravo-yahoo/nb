import { readFile } from 'fs/promises'
import { homedir } from 'os'
import path from 'path'

const REQUIRED_CONFIG_KEYS = ['url', 'token', 'org', 'bucket']

export async function loadConfig() {
  const config = {
    url: process.env.INFLUX_HOST,
    token: process.env.INFLUX_TOKEN,
    org: process.env.INFLUX_ORG,
    bucket: process.env.INFLUX_BUCKET
  }

  // If any config is missing from env, try to load from ~/.nbrc
  const missingFromEnv = REQUIRED_CONFIG_KEYS.some(key => !config[key])

  if (missingFromEnv) {
    try {
      const rcPath = path.join(homedir(), '.nbrc')
      const rcContent = await readFile(rcPath, 'utf-8')
      const rcConfig = JSON.parse(rcContent)

      // Only fill in missing values from rc file
      for (const key of REQUIRED_CONFIG_KEYS) {
        if (!config[key] && rcConfig[key]) {
          config[key] = rcConfig[key]
        }
      }
    } catch (err) {
      // ~/.nbrc doesn't exist or is invalid - that's okay if env vars are set
    }
  }

  return config
}

export function validateConfig(config) {
  const missing = REQUIRED_CONFIG_KEYS.filter(key => !config[key])

  if (missing.length > 0) {
    throw new Error(
      `Missing required InfluxDB configuration: ${missing.join(', ')}\n` +
      `Set environment variables (INFLUX_HOST, INFLUX_TOKEN, INFLUX_ORG, INFLUX_BUCKET)\n` +
      `or create ~/.nbrc with JSON config: { "url": "...", "token": "...", "org": "...", "bucket": "..." }`
    )
  }

  return config
}
