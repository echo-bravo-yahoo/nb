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

// TUI helpers
import { default as windowSize } from 'window-size'

export const defaultStream = {
  values: []
}

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

export function generateDimension(argDimension, dimensionName) {
  let current = windowSize[dimensionName]
  // height defaults to 1 less so you can see the command you ran
  let dimension = dimensionName === 'width' ? current : current - 1
  if (argDimension) {
    if (typeof argDimension === "string" && argDimension.includes('%')) {
      dimension = Math.ceil(current * (Number(argDimension.split('%')[0]) / 100))
    } else {
      dimension = Number(argDimension)
    }
  }
  return dimension
}

// This function is a little nuts, and probably not worth it. Use it as a 
// tagged template literal (e.g. printIfExists`foo ${var} bar`) to print 
// the string if `var` "exists" where "exists" is some pseudo definition 
// that I made up. So yeah. There's that.
export function printIfExists(strings, input, ...otherArgs) {
  if (otherArgs.length > 0) {
    throw new Error(`Unexpected usage! Use like ${printIfExists.name}\`before ${variable} after\`.`)
  }

  function wrap(str) {
    return strings[0] + str + strings[1]
  }

  if (input !== undefined) {
    if (input && Array.isArray(input) && input.length > 0) {
      return wrap(input.join(', '))
    }

    else if (input && typeof input === 'object' && Object.keys(input).length > 0) {
      try {
        return wrap(JSON.stringify(input))
      } catch (e) {
        return wrap(input)
      }
    }

    else if (
      (typeof input === 'string' && input !== '') ||
      (typeof input === 'number') ||
      (typeof input === 'boolean')
    ) {
      return wrap(input)
    }
  }

  // if we've fallen all the way through without returning, display nothing
  return ''
}

export function handleValueAndTags(value, tags) {
  // for a dumb edge-case where Number('') returns 0
  let valueAsNumber = value === '' ? NaN : Number(value)
  let valueIsNotNumber = Number.isNaN(valueAsNumber)
  // prevents us from making an "undefined" tag when value is not provided
  let valueIsTag = valueIsNotNumber && value !== undefined && value !== ''

  let finalValue = valueIsNotNumber ? 1 : valueAsNumber
  let finalTags = (valueIsTag ? [value, ...tags] : tags)
    .map(tag => tag.trim()) // trim out spacing for the case where someone does `note <stream> '  tag'`
    .filter(tag => tag !== '')

  return { value: finalValue, tags: finalTags }
}