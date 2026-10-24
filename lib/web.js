import http from 'http'
import { readFile } from 'fs/promises'
import path from 'path'

import { buildPoint } from './note.js'

const MAX_BODY_BYTES = 16 * 1024
const STATIC_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.woff2': 'font/woff2'
}

class HttpError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

function sendJson(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' })
  res.end(JSON.stringify(body))
}

function sendText(res, status, text) {
  res.writeHead(status, { 'content-type': 'text/plain; charset=utf-8' })
  res.end(text)
}

// Past the limit the rest of the body is drained and discarded, not left unread,
// so the client is still reading when the 413 arrives.
function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    let size = 0
    req.on('data', chunk => {
      size += chunk.length
      if (size <= MAX_BODY_BYTES) chunks.push(chunk)
    })
    req.on('end', () => {
      if (size > MAX_BODY_BYTES) reject(new HttpError(413, 'Request body is larger than 16 KiB'))
      else resolve(Buffer.concat(chunks).toString('utf-8'))
    })
    req.on('error', reject)
  })
}

async function readJson(req) {
  // A cross-site page can send a text/plain POST without a CORS preflight,
  // so requiring application/json keeps such a page from writing a point.
  const type = (req.headers['content-type'] ?? '').split(';')[0].trim().toLowerCase()
  if (type !== 'application/json') throw new HttpError(415, 'Expected content-type application/json')

  const text = await readBody(req)
  let body
  try {
    body = JSON.parse(text)
  } catch {
    throw new HttpError(400, 'Request body is not valid JSON')
  }
  if (body === null || typeof body !== 'object') throw new HttpError(400, 'Request body must be a JSON object')
  return body
}

async function serveFile(res, webRoot, pathname) {
  let file
  try {
    file = path.resolve(webRoot, '.' + decodeURIComponent(pathname === '/' ? '/index.html' : pathname))
  } catch {
    return sendText(res, 404, 'Not found')
  }
  const type = STATIC_TYPES[path.extname(file)]
  if (!type || !file.startsWith(webRoot + path.sep)) return sendText(res, 404, 'Not found')

  let data
  try {
    data = await readFile(file)
  } catch {
    return sendText(res, 404, 'Not found')
  }
  res.writeHead(200, { 'content-type': type })
  res.end(data)
}

export function createServer({ getStream, listStreams, writePoint, webRoot }) {
  webRoot = path.resolve(webRoot)

  async function recordNote(req) {
    const body = await readJson(req)

    const stream = await getStream(body.stream)
    if (!stream) throw new HttpError(400, `Stream "${body.stream}" does not exist`)

    const timestamp = body.time === undefined ? Date.now() : Date.parse(body.time)
    if (!Number.isFinite(timestamp)) throw new HttpError(400, `Could not parse time "${body.time}"`)

    let point
    try {
      point = buildPoint(stream, { value: body.value, tags: body.tags ?? {}, timestamp })
    } catch (err) {
      throw new HttpError(400, err.message)
    }

    try {
      await writePoint(point)
    } catch (err) {
      console.error(err)
      throw new HttpError(502, `InfluxDB write failed: ${err.message}`)
    }

    console.log(`noted ${stream.name} at ${new Date(timestamp).toISOString()}`)
    return { stream: stream.name, timestamp }
  }

  return http.createServer(async (req, res) => {
    // getStream and listStreams throw when ~/.nbrc is malformed, hence the 500 fallback.
    try {
      const { pathname } = new URL(req.url, 'http://localhost')
      if (req.method === 'GET' && pathname === '/healthz') return sendText(res, 200, 'ok')
      if (req.method === 'GET' && pathname === '/api/streams') return sendJson(res, 200, await listStreams())
      if (req.method === 'POST' && pathname === '/api/notes') return sendJson(res, 201, await recordNote(req))
      if (req.method === 'GET') return await serveFile(res, webRoot, pathname)
      sendText(res, 404, 'Not found')
    } catch (err) {
      if (err instanceof HttpError) return sendJson(res, err.status, { error: err.message })
      console.error(err)
      sendJson(res, 500, { error: err.message })
    }
  })
}
