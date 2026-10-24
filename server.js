import process from 'process'
import { fileURLToPath } from 'url'

import { getStream, listStreams } from './lib/streams.js'
import { writePoint } from './lib/influx.js'
import { createServer } from './lib/web.js'

// Node runs as PID 1 in the container, where SIGTERM has no default handler,
// so without this `docker restart nb` waits out its 10-second timeout.
process.on('SIGTERM', () => process.exit(0))

const port = Number(process.env.PORT ?? 8080)
const webRoot = fileURLToPath(new URL('./web', import.meta.url))

createServer({ getStream, listStreams, writePoint, webRoot })
  .listen(port, () => console.log(`nb web form listening on port ${port}`))
