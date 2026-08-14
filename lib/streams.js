import { readFile, writeFile } from 'fs/promises'
import { homedir } from 'os'
import path from 'path'

const NBRC_FILE = path.join(homedir(), '.nbrc')

async function loadNbrc() {
  try {
    const content = await readFile(NBRC_FILE, 'utf-8')
    return JSON.parse(content)
  } catch (err) {
    if (err.code === 'ENOENT') {
      return {}
    }
    throw err
  }
}

async function saveNbrc(data) {
  await writeFile(NBRC_FILE, JSON.stringify(data, null, 2), 'utf-8')
}

export async function loadStreams() {
  const nbrc = await loadNbrc()
  return nbrc.streams || {}
}

export async function saveStreams(streams) {
  const nbrc = await loadNbrc()
  nbrc.streams = streams
  await saveNbrc(nbrc)
}

export async function getStream(name) {
  const streams = await loadStreams()
  return streams[name] || null
}

export async function createStream({ name, measure, tags = [], type = 'float', fields = null }) {
  const streams = await loadStreams()

  if (streams[name]) {
    throw new Error(`Stream "${name}" already exists`)
  }

  // tags is now an array of tag definition objects:
  // [{ name, type, enumValues?, elementType? }, ...]
  // fields (multi-field streams): [{ name, type, optional? }, ...]
  streams[name] = fields
    ? { name, measure, tags, fields }
    : { name, measure, tags, type }

  await saveStreams(streams)
  return streams[name]
}

export async function deleteStream(name) {
  const streams = await loadStreams()

  if (!streams[name]) {
    throw new Error(`Stream "${name}" does not exist`)
  }

  delete streams[name]
  await saveStreams(streams)
}

export async function listStreams() {
  const streams = await loadStreams()
  return Object.values(streams)
}

export function formatTagDef(tagDef) {
  switch (tagDef.type) {
    case 'enum':
      return `${tagDef.name}:enum(${tagDef.enumValues.join('|')})`
    case 'array':
      return `${tagDef.name}:${tagDef.elementType}[]`
    default:
      return `${tagDef.name}:${tagDef.type}`
  }
}

export function formatFieldsDef(fields) {
  return fields.map(f => `${f.name}${f.optional ? '?' : ''}:${f.type}`).join(',')
}
