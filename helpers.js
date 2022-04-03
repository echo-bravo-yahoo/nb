// node.js imports
import { readFile } from 'fs/promises'

// time helpers
import TimeAgo from 'javascript-time-ago'
const en = JSON.parse(await readFile(new URL('./node_modules/javascript-time-ago/locale/en.json', import.meta.url)))
TimeAgo.addDefaultLocale(en)
const timeAgo = new TimeAgo('en-US')
import chrono from 'chrono-node'
import prt from 'parse-relative-time'
const parseRelativeTime = prt.default

export const defaultStream = {
  values: []
}

export function parseTimestamp(timestamp) {
  if (chrono.parseDate(timestamp)) {
    return chrono.parseDate(timestamp).getTime()
  } else if (parseRelativeTime(timestamp)) {
    return parseRelativeTime(timestamp)
  } else {
    // TODO: Fix up this branch...
    const tooOld = new Date(new Date().getFullYear - 100, 0, 1)
    const tooNew = new Date(new Date().getFullYear + 100, 0, 1)
    if (timestamp > tooOld && timestamp < tooNew) {
      return timestamp
    } else {
      throw new Error(`could not parse timestamp ${timestamp}!`)
    }
  }
}

export function formatStreamName(stream) {
  if (stream.name) {
    return `${stream.name} (${stream.id})`
  } else {
    return stream.id
  }
}

export function indexOrNot(indexOrTimestamp) {
  if (indexOrTimestamp <= 10000) {
    return true
  } else {
    return false
  }
}

export function formatTime(timestamp, formatOption) {
  if (formatOption === 'unix') {
    return timestamp
  } else if (formatOption === 'relative') {
    return timeAgo.format(timestamp)
  } else if (formatOption === 'date') {
    return new Intl.DateTimeFormat('en-US').format(timestamp)
  }
}

