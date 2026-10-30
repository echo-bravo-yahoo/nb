import { test, before, after, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'

import { createServer } from '../lib/web.js'
import { weight, bp, habit, eczema, demiMed } from './fixtures.js'

const webRoot = fileURLToPath(new URL('../web', import.meta.url))
const streams = { weight, bp, habit, eczema, demi_med: demiMed }

async function start(writePoint) {
  const server = createServer({
    getStream: async name => streams[name] ?? null,
    listStreams: async () => Object.values(streams),
    writePoint,
    webRoot
  })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  return { server, base: `http://127.0.0.1:${server.address().port}` }
}

function postNote(base, body, contentType = 'application/json') {
  return fetch(`${base}/api/notes`, {
    method: 'POST',
    headers: { 'content-type': contentType },
    body: typeof body === 'string' ? body : JSON.stringify(body)
  })
}

let server, base
const written = []

before(async () => {
  ({ server, base } = await start(async point => { written.push(point) }))
})
after(() => server.close())
beforeEach(() => { written.length = 0 })

test('GET /healthz returns 200', async () => {
  const res = await fetch(`${base}/healthz`)
  assert.equal(res.status, 200)
})

test('GET / serves the form', async () => {
  const res = await fetch(`${base}/`)
  assert.equal(res.status, 200)
  assert.match(res.headers.get('content-type'), /^text\/html/)
})

test('GET /api/streams lists the streams', async () => {
  const res = await fetch(`${base}/api/streams`)
  assert.equal(res.status, 200)
  assert.deepEqual(await res.json(), Object.values(streams))
})

test('POST /api/notes writes the point', async () => {
  const time = '2026-10-24T15:00:00.000Z'
  const res = await postNote(base, { stream: 'weight', value: '17.74', tags: { person: 'little' }, time })
  assert.equal(res.status, 201)
  assert.deepEqual(await res.json(), { stream: 'weight', timestamp: Date.parse(time) })
  assert.deepEqual(written, [
    { measurement: 'weight', tags: { person: 'little' }, value: 17.74, type: 'float', timestamp: Date.parse(time) }
  ])
})

test('POST /api/notes without a time uses the server clock', async () => {
  const res = await postNote(base, { stream: 'bp', value: { systolic: '116', diastolic: '64' } })
  assert.equal(res.status, 201)
  assert.equal(written.length, 1)
  assert.ok(Math.abs(written[0].timestamp - Date.now()) < 1000)
})

const ONE = { name: 'value', type: 'integer', value: 1 }

test('POST /api/notes writes an event as value=1', async () => {
  const res = await postNote(base, { stream: 'eczema' })
  assert.equal(res.status, 201)
  assert.deepEqual(written.map(point => point.fields), [[ONE]])
})

test('POST /api/notes writes the default of an event field', async () => {
  await postNote(base, { stream: 'habit', tags: { item: 'metamucil' } })
  await postNote(base, { stream: 'habit', tags: { item: 'oats' } })
  await postNote(base, { stream: 'demi_med' })
  assert.deepEqual(written.map(point => point.fields), [
    [ONE, { name: 'dose_g', type: 'float', value: 10 }],
    [ONE],
    [ONE, { name: 'dose_ml', type: 'float', value: 0.2 }]
  ])
})

test('POST /api/notes writes an overridden event field', async () => {
  const res = await postNote(base, { stream: 'demi_med', value: { dose_ml: '0.3' } })
  assert.equal(res.status, 201)
  assert.deepEqual(written.map(point => point.fields), [[ONE, { name: 'dose_ml', type: 'float', value: 0.3 }]])
})

test('POST /api/notes rejects a body that is not JSON', async () => {
  const res = await postNote(base, 'x', 'text/plain')
  assert.equal(res.status, 415)
  assert.equal(written.length, 0)
})

for (const [name, body] of [
  ['an unknown stream', { stream: 'nope', value: '1' }],
  ['a bad enum value', { stream: 'weight', value: '1', tags: { person: 'bob' } }],
  ['an unparseable time', { stream: 'weight', value: '1', tags: { person: 'little' }, time: 'garbage' }],
  ['a value on an event stream', { stream: 'eczema', value: '1' }]
]) {
  test(`POST /api/notes returns 400 for ${name}`, async () => {
    const res = await postNote(base, body)
    assert.equal(res.status, 400)
    assert.equal(typeof (await res.json()).error, 'string')
    assert.equal(written.length, 0)
  })
}

test('POST /api/notes rejects a body over 16 KiB', async () => {
  const res = await postNote(base, { stream: 'weight', value: 'x'.repeat(17 * 1024) })
  assert.equal(res.status, 413)
  assert.equal(written.length, 0)
})

test('POST /api/notes returns 502 when the write fails', async () => {
  const failing = await start(async () => { throw new Error('boom') })
  try {
    const res = await postNote(failing.base, { stream: 'weight', value: '1', tags: { person: 'little' } })
    assert.equal(res.status, 502)
    assert.match((await res.json()).error, /boom/)
  } finally {
    failing.server.close()
  }
})

test('static files cannot escape the web root', async () => {
  const res = await fetch(`${base}/..%2fpackage.json`)
  assert.equal(res.status, 404)
})
