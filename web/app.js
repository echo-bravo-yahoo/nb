// Most notes repeat the previous stream and person, so the last choices are remembered.
const STORAGE_KEY = 'nb:last'
const SEGMENTED_MAX = 5

const form = document.getElementById('note')
const status = document.getElementById('status')

let last = loadLast()

function loadLast() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY))
    return { stream: saved?.stream, tags: saved?.tags ?? {} }
  } catch {
    return { tags: {} }
  }
}

function saveLast(stream, tags) {
  last = { stream, tags: { ...last.tags, [stream]: tags } }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(last))
  } catch {}
}

function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag)
  for (const [key, val] of Object.entries(attrs)) {
    if (val === false || val === undefined) continue
    el.setAttribute(key, val === true ? '' : val)
  }
  el.append(...children)
  return el
}

function showStatus(kind, text) {
  status.replaceChildren(h('div', { class: `banner banner-${kind}` }, h('div', { class: 'banner-body' }, text)))
}

let nextId = 0

// Each field builder returns { el, read }, where read() gives the value to send.
function inputField(label, attrs) {
  const input = h('input', { class: 'input', ...attrs })
  return {
    el: h('label', { class: 'field' }, h('span', { class: 'field-label' }, label), input),
    read: () => input.value
  }
}

function selectField(label, options, selected) {
  const select = h('select', { class: 'input' }, ...options.map(option => h('option', { value: option }, option)))
  if (options.includes(selected)) select.value = selected
  return {
    el: h('label', { class: 'field' }, h('span', { class: 'field-label' }, label), select),
    read: () => select.value
  }
}

function segmentedField(label, options, selected) {
  const labelId = `label-${++nextId}`
  const group = h('div', { class: 'segmented segmented-block', role: 'group', 'aria-labelledby': labelId })
  const press = value => {
    for (const button of group.children) button.setAttribute('aria-pressed', String(button.value === value))
  }
  for (const option of options) {
    const button = h('button', { type: 'button', class: 'segmented-item', value: option }, option)
    button.addEventListener('click', () => press(option))
    group.append(button)
  }
  press(options.includes(selected) ? selected : options[0])
  return {
    el: h('div', { class: 'field' }, h('span', { class: 'field-label', id: labelId }, label), group),
    read: () => group.querySelector('[aria-pressed="true"]').value
  }
}

function capitalize(name) {
  return name.charAt(0).toUpperCase() + name.slice(1)
}

function tagField(def, saved) {
  const label = capitalize(def.name)
  switch (def.type) {
    case 'enum':
      return def.enumValues.length <= SEGMENTED_MAX
        ? segmentedField(label, def.enumValues, saved)
        : selectField(label, def.enumValues, saved)
    case 'number':
      return inputField(label, { type: 'number', step: 'any', inputmode: 'decimal', required: true, value: saved })
    case 'array': {
      const field = inputField(label, {
        type: 'text',
        required: true,
        value: Array.isArray(saved) ? saved.join(', ') : undefined
      })
      return { ...field, read: () => field.read().split(',').map(item => item.trim()).filter(Boolean) }
    }
    default:
      return inputField(label, { type: 'text', required: true, value: saved })
  }
}

function valueField(label, type, optional = false, defaultValue) {
  const placeholder = defaultValue !== undefined ? `default ${defaultValue}` : optional ? 'optional' : undefined
  const attrs = { required: !optional, placeholder }
  switch (type) {
    case 'float':
      return inputField(label, { type: 'number', step: 'any', inputmode: 'decimal', ...attrs })
    case 'integer':
      return inputField(label, { type: 'number', step: '1', inputmode: 'numeric', ...attrs })
    case 'boolean':
      return segmentedField(label, ['true', 'false'], String(defaultValue))
    default:
      return inputField(label, { type: 'text', ...attrs })
  }
}

let streams = []
let tagFields = []
let valueFields = []

const streamSelect = h('select', { class: 'input' })
const streamSection = h('div', { class: 'stack' })

function currentStream() {
  return streams.find(stream => stream.name === streamSelect.value)
}

// Rebuilding the section is also how the value inputs are cleared after a note is recorded.
function renderStream() {
  const stream = currentStream()
  const saved = last.tags[stream.name] ?? {}
  tagFields = stream.tags.map(def => [def.name, tagField(def, saved[def.name])])
  // A blank input means the field's default, which the server applies.
  valueFields = stream.fields
    ? stream.fields.map(fd => [
        fd.name,
        valueField(capitalize(fd.name), fd.type, fd.optional || fd.default !== undefined, fd.default)
      ])
    : stream.type === 'event' ? [] : [[null, valueField('Value', stream.type)]]
  streamSection.replaceChildren(...[...tagFields, ...valueFields].map(([, field]) => field.el))
}

function readNote(stream) {
  const tags = Object.fromEntries(tagFields.map(([name, field]) => [name, field.read()]))
  if (stream.type === 'event' && !stream.fields) return { tags }
  if (!stream.fields) return { tags, value: valueFields[0][1].read() }

  const value = {}
  for (const [name, field] of valueFields) {
    const fieldValue = field.read()
    if (fieldValue !== '') value[name] = fieldValue
  }
  return { tags, value }
}

function describeValue(value) {
  return typeof value === 'string'
    ? value
    : Object.entries(value).map(([name, fieldValue]) => `${name} ${fieldValue}`).join(', ')
}

// Untouched, the time follows the clock and the server stamps the note itself.
// Once edited, the chosen time is sent until Now returns it to the untouched state.
const timeInput = h('input', { class: 'input row-fill', type: 'datetime-local', id: 'time', required: true })
const nowButton = h('button', { type: 'button', class: 'btn btn-ghost btn-sm', hidden: true }, 'Now')
let timeEdited = false

function localMinute(date) {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16)
}

function resetTime() {
  timeEdited = false
  nowButton.hidden = true
  timeInput.value = localMinute(new Date())
}

timeInput.addEventListener('input', () => {
  timeEdited = true
  nowButton.hidden = false
})
nowButton.addEventListener('click', resetTime)
setInterval(() => {
  if (!timeEdited) timeInput.value = localMinute(new Date())
}, 30_000)

const recordButton = h('button', { type: 'submit', class: 'btn btn-primary btn-block' }, 'Record')

form.addEventListener('submit', async event => {
  event.preventDefault()
  const stream = currentStream()
  const { tags, value } = readNote(stream)
  const body = { stream: stream.name, tags, value }
  if (timeEdited) body.time = new Date(timeInput.value).toISOString()

  status.replaceChildren()
  recordButton.disabled = true
  try {
    let res
    try {
      res = await fetch('/api/notes', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body)
      })
    } catch {
      return showStatus('bad', 'Could not reach the server')
    }
    const data = await res.json().catch(() => ({ error: `The server answered ${res.status}` }))
    if (!res.ok) return showStatus('bad', data.error)

    saveLast(stream.name, tags)
    renderStream()
    resetTime()
    const at = new Date(data.timestamp).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })
    const nothingGiven = value === undefined || (typeof value === 'object' && Object.keys(value).length === 0)
    showStatus('ok', `Noted ${nothingGiven ? 'an event' : describeValue(value)} in ${stream.name} at ${at}`)
  } finally {
    recordButton.disabled = false
  }
})

try {
  const res = await fetch('/api/streams')
  if (!res.ok) throw new Error(`the server answered ${res.status}`)
  streams = await res.json()
  if (streams.length === 0) showStatus('bad', 'No streams are defined in ~/.nbrc')
} catch (err) {
  showStatus('bad', `Could not load streams: ${err.message}`)
}

if (streams.length > 0) {
  streamSelect.append(...streams.map(stream => h('option', { value: stream.name }, stream.name)))
  if (streams.some(stream => stream.name === last.stream)) streamSelect.value = last.stream
  streamSelect.addEventListener('change', renderStream)

  form.append(
    h('label', { class: 'field' }, h('span', { class: 'field-label' }, 'Stream'), streamSelect),
    streamSection,
    h('div', { class: 'field' },
      h('label', { class: 'field-label', for: 'time' }, 'Time'),
      h('div', { class: 'row row-tight' }, timeInput, nowButton)
    ),
    recordButton
  )
  renderStream()
  resetTime()
  form.hidden = false
}
