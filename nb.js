#!/usr/bin/env node

import process from 'process'
import { readFile } from 'fs/promises'

// CLI helpers
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import updateNotifier from 'update-notifier'
const pkg = JSON.parse(await readFile(new URL('./package.json', import.meta.url)))

// Local modules
import { parseTimestamp } from './helpers.js'
import { getStream, createStream, deleteStream, listStreams, formatTagDef, formatFieldsDef } from './lib/streams.js'
import { writePoint, closeWriteApi } from './lib/influx.js'
import {
  parseTagDefinition,
  parseFieldDefinition,
  parseMultiFieldValue,
  validateProvidedTags,
  validateValueType,
  coerceValue
} from './lib/validation.js'

updateNotifier({ pkg }).notify()

yargs(hideBin(process.argv))
  .command({
    command: 'note <value>',
    description: 'record something worth remembering',
    builder: yargs => {
      return yargs
        .positional('value', { describe: 'the value to record', type: 'string' })
        .option('stream', {
          alias: 's',
          describe: 'the stream to write to',
          type: 'string',
          demandOption: true
        })
        .option('time', {
          alias: 't',
          describe: 'timestamp for the note (natural language supported)',
          type: 'string'
        })
        .parserConfiguration({
          'unknown-options-as-args': false
        })
        .strict(false) // Allow unknown options (dynamic tags)
    },
    handler: async (args) => {
      try {
        // Look up stream
        const stream = await getStream(args.stream)
        if (!stream) {
          console.error(`Error: Stream "${args.stream}" does not exist.`)
          console.error('Create it first with: nb stream create <name> --measure <measureName>')
          process.exit(1)
        }

        // Validate provided tags against stream definition
        const validatedTags = validateProvidedTags(args, stream.tags)

        // Parse timestamp
        const timestamp = args.time ? parseTimestamp(args.time) : Date.now()

        // Convert validated tags for InfluxDB (stringify arrays and numbers for tags)
        const influxTags = {}
        for (const [key, val] of Object.entries(validatedTags)) {
          if (Array.isArray(val)) {
            influxTags[key] = JSON.stringify(val)
          } else {
            influxTags[key] = String(val)
          }
        }

        // Write to InfluxDB
        if (stream.fields) {
          // Multi-field stream: parse "key:val,key:val,..." value
          const fieldValues = parseMultiFieldValue(args.value, stream.fields)
          const fields = stream.fields
            .filter(fd => fd.name in fieldValues)
            .map(fd => ({ name: fd.name, type: fd.type, value: fieldValues[fd.name] }))
          await writePoint({ measurement: stream.measure, tags: influxTags, fields, timestamp })
        } else {
          const typedValue = coerceValue(args.value, stream.type)
          await writePoint({
            measurement: stream.measure,
            tags: influxTags,
            value: typedValue,
            type: stream.type,
            timestamp
          })
        }

        await closeWriteApi()

        if (args.time) {
          console.log(`Noted ${args.value} in stream "${args.stream}" at ${args.time}.`)
        } else {
          console.log(`Noted ${args.value} in stream "${args.stream}".`)
        }
      } catch (err) {
        console.error(`Error: ${err.message}`)
        process.exit(1)
      }
    }
  })
  .command({
    command: 'stream',
    description: 'manage streams',
    builder: yargs => {
      return yargs
        .command({
          command: 'list',
          description: 'list all streams',
          handler: async () => {
            try {
              const streams = await listStreams()

              if (streams.length === 0) {
                console.log('No streams defined.')
                console.log('Create one with: nb stream create <name> --measure <measureName>')
                return
              }

              for (const stream of streams) {
                const tagsStr = stream.tags.length > 0
                  ? `[${stream.tags.map(formatTagDef).join(', ')}]`
                  : '[]'
                const typeStr = stream.fields
                  ? `{${formatFieldsDef(stream.fields)}}`
                  : stream.type
                console.log(`${stream.name} (${typeStr}) ${tagsStr} -> measurement: ${stream.measure}`)
              }
            } catch (err) {
              console.error(`Error: ${err.message}`)
              process.exit(1)
            }
          }
        })
        .command({
          command: 'create <name>',
          description: 'create a new stream',
          builder: yargs => {
            return yargs
              .positional('name', { describe: 'name of the stream', type: 'string' })
              .option('measure', {
                alias: 'm',
                describe: 'InfluxDB measurement name',
                type: 'string',
                demandOption: true
              })
              .option('tag', {
                alias: 't',
                describe: 'tag definition: "name,type[,options...]" (can be used multiple times)',
                type: 'string',
                array: true,
                default: []
              })
              .option('type', {
                describe: 'value type for the measurement (ignored when --fields is used)',
                type: 'string',
                choices: ['float', 'integer', 'string', 'boolean'],
                default: 'float'
              })
              .option('fields', {
                describe: 'multi-field definitions: "name:type,name?:type,..." (? = optional)',
                type: 'string'
              })
          },
          handler: async (args) => {
            try {
              const tags = args.tag.map(parseTagDefinition)

              let fields = null
              if (args.fields) {
                fields = args.fields.split(',').map(parseFieldDefinition)
              } else {
                validateValueType(args.type)
              }

              await createStream({
                name: args.name,
                measure: args.measure,
                tags,
                type: args.type,
                fields
              })

              const tagsStr = tags.length > 0
                ? `[${tags.map(formatTagDef).join(', ')}]`
                : '[]'
              const typeStr = fields ? `{${formatFieldsDef(fields)}}` : args.type
              console.log(`Created stream "${args.name}" (${typeStr}) ${tagsStr} -> measurement: ${args.measure}`)
            } catch (err) {
              console.error(`Error: ${err.message}`)
              process.exit(1)
            }
          }
        })
        .command({
          command: 'delete <stream>',
          description: 'delete a stream',
          builder: yargs => {
            return yargs
              .positional('stream', { describe: 'name of the stream to delete', type: 'string' })
              .option('yes', {
                alias: 'y',
                describe: 'confirm deletion',
                type: 'boolean',
                default: false
              })
          },
          handler: async (args) => {
            try {
              if (!args.yes) {
                console.error('Error: Deletion requires confirmation. Use --yes or -y flag.')
                process.exit(1)
              }

              await deleteStream(args.stream)
              console.log(`Deleted stream "${args.stream}".`)
            } catch (err) {
              console.error(`Error: ${err.message}`)
              process.exit(1)
            }
          }
        })
        .demandCommand()
        .help()
    },
    handler: () => {}
  })
  .demandCommand()
  .help()
  .argv
