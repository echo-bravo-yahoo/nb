import { readFile } from 'fs/promises'

// time helpers
import TimeAgo from 'javascript-time-ago'
const en = JSON.parse(await readFile(new URL('./node_modules/javascript-time-ago/locale/en.json', import.meta.url)))
TimeAgo.addDefaultLocale(en)
const timeAgo = new TimeAgo('en-US')
import chrono from 'chrono-node'
import prt from 'parse-relative-time'
const parseRelativeTime = prt.default

export function parseTimestamp(timestamp) {
  // chrono takes natural language, eg, 5 days ago, this Friday at 13:00, etc.
  if (chrono.parseDate(timestamp)) {
    return chrono.parseDate(timestamp).getTime()
  // parse-relative-time takes relative descriptions, eg, 2 days, -2 days, in 1 week
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

export function formatTime(timestamp, formatOption) {
  if (formatOption === 'unix') {
    return timestamp
  } else if (formatOption === 'relative') {
    return timeAgo.format(timestamp)
  } else if (formatOption === 'date') {
    return new Intl.DateTimeFormat('en-US').format(timestamp)
  }
}
