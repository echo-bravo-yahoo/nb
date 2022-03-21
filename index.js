#!/usr/bin/env node

const flatfile = require('flat-file-db')
const db = flatfile.sync('./database.db')

const yargs = require('yargs/yargs')
const { hideBin } = require('yargs/helpers')

const defaultStream = {
  values: []
}

function formatStreamName(stream) {
  if (stream.name) {
    return `${stream.name} (${stream.id})`
  } else {
    return stream.id
  }
}

function indexOrNot(indexOrTimestamp) {
  if (indexOrTimestamp <= 10000) {
    return true
  } else {
    return false
  }
}

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
        let values = [...stream.values, [ args.timestamp, args.value ]].sort((a, b) => a[0] - b[0])
        db.put(args.stream, { ...stream, values })
        console.log(`noted ${args.value} in stream ${formatStreamName(stream)} at time ${args.timestamp}.`)
      } else {
        db.put(args.stream, { ...stream, values: [...stream.values, [ Date.now(), args.value ]] })
        console.log(`noted ${args.value} in stream ${formatStreamName(stream)}.`)
      }
    }
  })
  .command({
    command: 'denote <stream> [note]',
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
            console.log(streams.map((key) => `${key} (${db.get(key).values.length})`).join('\n'))
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
              .option('format', { describe: 'the format of the output', choices: ['csv', 'table', 'graph', 'json', 'timeline'], default: 'csv' })
          },
          handler: args => {
            const stream = db.get(args.stream)
            if (stream === undefined) throw Error(`stream ${args.stream} does not exist.`)
            if (args.format !== 'csv') throw Error(`format ${args.format} not implemented yet.`)
            for(let i = 0; i < stream.values.length; i++) {
              console.log(`${i}, ${stream.values[i][0]}, ${stream.values[i][1]}`)
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
    },
    handler: args => {
      yargs.help()
    }
  })
  .help()
  .argv