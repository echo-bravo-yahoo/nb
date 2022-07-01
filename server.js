import { execSync } from 'child_process'
import path from 'path'
import { fileURLToPath } from 'url'

import flatfile from 'flat-file-db'  // docs: https://github.com/mafintosh/flat-file-db#api

import server from 'server'
const { get, post } = server.router

const __dirname = path.dirname(fileURLToPath(import.meta.url))
let nb = path.resolve(__dirname, 'nb.js')

const db = flatfile.sync(path.join(__dirname, 'server-config.db'))

// this function is only used by the web code
// do not add any node-specific stuff in it
// do not run it outside of the rendered output
async function doCommand(event) {
  event.preventDefault()
  let text = await (await fetch(window.location.pathname, { method: 'POST' })).text()
  let outputElement = document.querySelector('#output')
  outputElement.innerHTML += text
}

function makeCommandsLinks(ctx, input) {
  let isInCommandSection = false
  let commandRegExp = /(nb\.js)\s+((?:(?!&|<|\[|  ).)+)\s/

  let lines = input.split('\n')
  .map(line => {

    if (line.startsWith('nb.js')) {
      let parsedLine = ''
      line.split(' ').reduce((itemsSoFar, item) => {
        let isAnArg = item.startsWith('&') || item.startsWith('[')
        if (item !== 'nb.js' && !isAnArg) {
          itemsSoFar.push(item)
        }
        if (!isAnArg) {
          parsedLine += `<a href="/nb/${itemsSoFar.join(' ')}">${item}</a> `
        } else {
          parsedLine += `${item} `
        }
        return itemsSoFar
      }, [])
      return parsedLine
    }

    if (line.startsWith('Commands:')) {
      isInCommandSection = true
    } 
    
    else if (isInCommandSection && line.startsWith('  ')) {
      return line.replace(commandRegExp, `$1 <a href="/nb/$2">$2</a> `)
    } 
    
    else if (isInCommandSection && !line.startsWith('  ')) {
      isInCommandSection = false
    } 
    
    return line
  })
  return lines.join("\n")
}

function sanitizeHtml(input) {
  return input.replace(/</g, '&#60;').replace(/>/g, '&#62;')
}

function runAndRenderPage(ctx, commandString) {
  return `<script>${doCommand.toString()}</script><pre>\n` +
    makeCommandsLinks(ctx, runAndRender(ctx, `${commandString} --help`)) +
    `\n\n` +
    `<a href='#' onclick="doCommand(event)">run <b>nb.js ${commandString}</b></a>` +
    `\n</pre>` +
    `<pre id="output"></pre>`
}

function runAndRender(ctx, commandString) {
  let command = `${nb} ${commandString}`
  let output
  try {
    output = execSync(command, { encoding: 'utf8' })
  } catch (e) {
    output = e.stdout + e.stderr
  }
  
  console.log(`> ${command}`)
  console.log(output)

  return `> nb.js ${sanitizeHtml(commandString)}\n\n`
    + sanitizeHtml(output)
}

function getCommand(ctx) {
  let commandString = decodeURIComponent(ctx.params.command).trim()
  
  let routes = db.get('recent') || {}
  if (!routes[commandString]) routes[commandString] = 0
  Object.keys(routes).forEach(key => {
    if (key !== commandString) {
      routes[key]--;
      if (routes[key] < 0) delete routes[key]
    }
  })
  routes[commandString] += 4;
  db.put('recent', routes)

  return commandString
}

const port = 8080

// because we're trying to be shape-agnostic, we don't care what the args are called so long as they exist
// this functions makes handler routes for both the --help and the regular commands for a certain length

server({ port, security: { csrf: false }}, [
  get('/', ctx => {

    let recents = db.get('recent') 
    let recentsText = ''
    if (recents) {
      recentsText = Object.entries(recents)
        .sort((a, b) => b[1] - a[1]).map(([key]) => {
          return `- <a href="nb/${key}">${key}</a>`
        })
        .join('<br />')
    }
    console.log()

    return `<a href="nb">nb</a><br />${recentsText}`
  }),
  
  get('/nb', ctx => runAndRenderPage(ctx, '')),
  post('/nb', ctx => runAndRender(ctx, '')),

  get('/nb/:command', ctx => runAndRenderPage(ctx, getCommand(ctx))),
  post('/nb/:command', ctx => runAndRender(ctx, getCommand(ctx)))
]);

console.log(`Listening on port ${port}...`)