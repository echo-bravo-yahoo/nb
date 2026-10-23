import { readFile } from 'fs/promises'
import { execFile } from 'child_process'
import { homedir } from 'os'
import path from 'path'
import { promisify } from 'util'

const execFileAsync = promisify(execFile)
const REQUIRED_CONFIG_KEYS = ['url', 'token', 'org', 'bucket']

// nb only ever writes to InfluxDB (there is no read/query command), so it
// always wants the write-scoped token. INFLUX_TOKEN is read-only and is
// exported into every shell by ~/.zshenv; INFLUX_WRITE_TOKEN lives in
// ~/.secrets.privileged.env, which is deliberately not auto-sourced. Reading
// it directly here (rather than requiring the caller to source-then-export
// it, which INFLUX_TOKEN's own export order defeats anyway) is what actually
// fixes the repeat 403s.
async function readPrivilegedWriteToken() {
  try {
    const { stdout } = await execFileAsync('bash', [
      '-c',
      'source "$HOME/.secrets.privileged.env" 2>/dev/null && printf %s "$INFLUX_WRITE_TOKEN"'
    ])
    return stdout || undefined
  } catch {
    return undefined
  }
}

export async function loadConfig() {
  const config = {
    url: process.env.INFLUX_HOST,
    token: process.env.INFLUX_WRITE_TOKEN || (await readPrivilegedWriteToken()) || process.env.INFLUX_TOKEN,
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
