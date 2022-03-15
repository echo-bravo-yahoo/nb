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
    },
    handler: args => {
      let stream = db.get(args.stream)
      if (stream === undefined) stream = { id: args.stream, ...defaultStream }
      db.put(args.stream, { ...stream, values: [...stream.values, [ Date.now(), args.value ]] })
      console.log(`noted ${args.value} in stream ${formatStreamName(stream)}.`)
    }
  })
  .command({
    command: 'denote <stream> <note>',
    description: 'delete a memory not worthy of rememberance',
    builder: yargs => {
    },
    handler: args => {
      let stream = db.get(args.stream)
      if (stream === undefined) throw Error(`stream ${args.stream} does not exist.`)
      let values = [...stream.values]
      if (indexOrNot(args.note)) {
        values.splice(args.note, 1)
      } else {
        values = values.filter((value) => value[0] !== args.note)
      }
      db.put(args.stream, { ...stream, values })
      console.log(`deleted note ${args.note} in stream ${formatStreamName(stream)}.`)
    }
  })
  .command({
    command: 'stream',
    description: 'manage streams of memory',
    builder: yargs => {
      return yargs
        .command({
          command: 'show <stream>',
          description: 'display memories',
          builder: yargs => {
            return yargs
              .positional('stream', { describe: 'the id of the stream you wish to recall', type: 'string' })
          },
          handler: args => {
            const stream = db.get(args.stream)
            if (stream === undefined) throw Error(`stream ${args.stream} does not exist.`)
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
