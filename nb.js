#!/usr/bin/env node

// node.js imports
import process from 'process'
import path from 'path'
import { fileURLToPath } from 'url'
const __dirname = path.dirname(fileURLToPath(import.meta.url))
import { readFile } from 'fs/promises'

// third-party imports
// databases
import flatfile from 'flat-file-db'  // docs: https://github.com/mafintosh/flat-file-db#api
const db = flatfile.sync(path.join(__dirname, 'database.db'))

// CLI helpers
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import updateNotifier from 'update-notifier'
const pkg = JSON.parse(await readFile(new URL('./package.json', import.meta.url)))

// TUI helpers
import AsciiTable from 'ascii-table'
import sparkly from 'sparkly'
import chart from 'chart'
import { default as windowSize } from 'window-size'

import {
  defaultStream,
  formatStreamName,
  formatTime,
  indexOrNot,
  parseTimestamp,
  generateDimension
} from './helpers.js'

updateNotifier({ pkg }).notify()

yargs(hideBin(process.argv))
  .command({
    command: 'note <stream> <value>',
    description: 'record something worth remembering',
    builder: yargs => {
      return yargs
        .positional('stream', { describe: 'the id of the stream to write to', type: 'string' })
        .positional('value', { describe: 'the value to remember' })
        .option('timestamp', { alias: 'ts' })
    },
    handler: args => {
      let stream = db.get(args.stream)
      if (stream === undefined) stream = { id: args.stream, ...defaultStream }

      if (args.timestamp) {
        const parsedTimestamp = parseTimestamp(args.timestamp)
        let values = [...stream.values, [ parsedTimestamp, args.value ]].sort((a, b) => a[0] - b[0])
        db.put(args.stream, { ...stream, values })
        console.log(`noted ${args.value} in stream ${formatStreamName(stream)} at time ${args.timestamp}.`)
      } else {
        db.put(args.stream, { ...stream, values: [...stream.values, [ Date.now(), args.value ]] })
        console.log(`noted ${args.value} in stream ${formatStreamName(stream)}.`)
      }
    }
  })
  .command({
    command: 'denote <stream> [index]',
    description: 'delete a memory not worthy of rememberance',
    builder: yargs => {
      return yargs
    },
    handler: args => {
      let stream = db.get(args.stream)
      if (stream === undefined) throw Error(`stream ${args.stream} does not exist.`)
      let values = [...stream.values]

      if (args.note === undefined) {
        // no note specified? delete the newest
        values.splice(values.length - 1, 1)
      } else if (indexOrNot(args.note)) {
        // note is small? delete the one at that index
        values.splice(args.note, 1)
      } else {
        // note is big? delete the one with that timestamp
        values = values.filter((value) => value[0] !== args.note)
      }

      db.put(args.stream, { ...stream, values })
      if (args.note === undefined) {
        console.log(`deleted latest note ${values.length} in stream ${formatStreamName(stream)}.`)
      } else {
        console.log(`deleted note ${args.note} in stream ${formatStreamName(stream)}.`)
      }
    }
  })
  .command({
    command: 'correct <stream> [index] [note]',
    description: 'correct a memory',
    builder: yargs => {
      return yargs
        .positional('stream', { describe: 'the stream containing the memory to replace' })
        .positional('index', { describe: 'the memory to replace; reference it by its timestamp or index. if not specified, the newest note will be corrected' })
        .option('note', { describe: 'the new note value' })
    },
    handler: args => {
      let stream = db.get(args.stream)
      if (stream === undefined)
        throw Error(`stream ${args.stream} does not exist.`)

      let values = [...stream.values]
      let correctionIndex
      if (args.index !== undefined) {
        for (let i = 0; i < values.length; i++) {
          if (values[i][0] === args.index || i === args.index) {
            correctionIndex = i
            break
          }
        }
      } else {
        correctionIndex = values.length - 1
      }

      if (correctionIndex === undefined)
        throw Error(`stream does not contain memory with index ${index}.`)

      const newValues = values
      newValues[correctionIndex] = [values[correctionIndex][0], args.note]

      db.put(args.stream, { ...stream, values: newValues })
      if (args.index === undefined) {
        console.log(`corrected latest note ${values.length} in stream ${formatStreamName(stream)}.`)
      } else {
        console.log(`corrected note ${args.index} in stream ${formatStreamName(stream)}.`)
      }
    }
  })
  .command({
    command: 'stream',
    description: 'manage streams of memory',
    builder: yargs => {
      return yargs
        .command({
          command: 'list',
          description: 'list streams',
          builder: yargs => {
            return yargs
          },
          handler: args => {
            const streams = db.keys()
            console.log(streams.map((key) => `${key} (${db.get(key).values.length})`).sort().join('\n'))
          }
        })
        .command({
          command: 'delete <stream>',
          description: 'delete a stream',
          builder: yargs => {
            return yargs
          },
          handler: args => {
            const streams = db.keys()
            if (db.has(args.stream)) {
              db.del(args.stream)
              console.log('Deleted stream.')
            } else {
              console.log('Stream does not exist.')
            }
          }
        })
        .command({
          command: 'merge <from> <to>',
          description: 'merge two streams together, deleting the "from" stream. if the "to" stream does not exist, this will effectively rename "from". no attempt will be made to dedupe entries.',
          builder: yargs => {
            return yargs
          },
          handler: args => {
            if (!db.has(args.from)) throw new Error(`stream ${args.from} does not exist. specify a different "from" stream.`)
            const from = db.get(args.from)
            const to = db.get(args.to)

            // could be time optimized to avoid the sort
            let result = from.values.concat(to.values)
            result = result.sort((a, b) => a[0] - b[0])
            db.put(args.to, { ...to, values: result })
            db.del(args.from)
            console.log(`merged stream ${args.from} into stream ${args.to}.`)
          }
        })
        .command({
          command: 'show <stream>',
          description: 'display memories',
          builder: yargs => {
            return yargs
              .positional('stream', { describe: 'the id of the stream you wish to recall', type: 'string' })
              // TODO: Implement timeline format
              .option('format', { describe: 'the format of the output', choices: ['csv', 'table', 'chart', 'graph', 'json', 'timeline'], default: 'csv' })
              .option('time-format', { describe: 'the format of timestamps in the output', choices: ['unix', 'relative', 'date'], default: 'relative' })
          },
          handler: args => {
            const stream = db.get(args.stream)
            if (stream === undefined) throw Error(`stream ${args.stream} does not exist.`)

            if (args.format === 'csv') {
              for(let i = 0; i < stream.values.length; i++) {
                console.log(`${i}, ${formatTime(stream.values[i][0], args.timeFormat)}, ${stream.values[i][1]}`)
              }
            } else if (args.format === 'chart') {
              console.log(chart(stream.values.map((value) => value[1]), {
                width: generateDimension(args.width, 'width'),
                height: generateDimension(args.height, 'height'),
                pointChar: '█',
                negativePointChar: '░'
              }))
            } else if (args.format === 'graph') {
              console.log(sparkly(stream.values.map((value) => value[1]), { minimum: 0 }))
            } else if (args.format === 'table') {
              const table = new AsciiTable(formatStreamName(stream))
              table.setHeading('index', 'time', 'value')
              table.addRowMatrix(stream.values.map((value, index) => [index, formatTime(value[0], args.timeFormat), value[1]]))
              console.log(table.toString())
            } else if (args.format === 'json') {
              console.log(JSON.stringify({ ...stream, values: stream.values.map((value, index) => [index, ...value]) }, null, 2))
            } else {
              throw Error(`format ${args.format} not implemented yet.`)
            }
          }
        })
        .command({
          command: 'update <stream>',
          description: 'update a stream',
          builder: yargs => {
            return yargs
              .option('name', { alias: 'n' })
          },
          handler: args => {
            const stream = db.get(args.stream)
            if (stream === undefined) throw Error(`stream ${args.stream} does not exist.`)
            if (args.name) { db.put(args.stream, {... stream, name: args.name }) }
            console.log(`updated stream ${formatStreamName(stream)}.`)
          }
        })
        .command({
          command: 'dashboard',
          description: 'show an overview of streams',
          builder: yargs => {
            return yargs
          },
          handler: async (args) => {
            const streamNames = db.keys()
            const streams = streamNames.map((streamName) => {
              return db.get(streamName)
            })
            const chartsPerRow = 4
            const rowCount = Math.ceil(streams.length / chartsPerRow)
            const charts = []
            const width = Math.floor(windowSize.width / chartsPerRow)
            const height = Math.floor((windowSize.height - 1) / rowCount)
            const chartArgs = {
              width: width,
              height: height,
              pointChar: '█',
              negativePointChar: '░',
              axisChar: '.'
            }

            for (let i = 0; i < streams.length; i++) {
              let temp = chart(streams[i].values.map((value) => value[1]), chartArgs)
              let tempArr = temp.split('\n')
              tempArr = tempArr.map((line) => {
                return line.slice(0, width).padEnd(width, ' ')
              })
              charts.push(tempArr)
            }

            for (let metaRow = 0; metaRow < rowCount; metaRow++) {
              for (let literalRow = 0; literalRow < height - 2; literalRow++) {
                let row = ''
                for(let column = 0; column < chartsPerRow; column++) {
                  if (metaRow * chartsPerRow + column < streams.length) {
                    row += charts[metaRow * chartsPerRow + column][literalRow]
                  }
                }
                console.log(row)
              }
            }
          }
        })
    },
    handler: args => {
      yargs.help()
    }
  })
  .help()
  .argv
