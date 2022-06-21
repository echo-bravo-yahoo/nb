import { execSync } from 'child_process'
import path from 'path'
import { fileURLToPath } from 'url'

import server from 'server'
const { get, post } = server.router

const __dirname = path.dirname(fileURLToPath(import.meta.url))
let nb = path.resolve(__dirname, 'nb.js')

// this function is only used by the web code
// do not add any node-specific stuff in it
// do not run it outside of the rendered output
async function doCommand(event) {
  event.preventDefault()
  let text = await (await fetch(window.location.pathname, { method: 'POST' })).text()
  let outputElement = document.querySelector('#output')
  outputElement.innerHTML += text
}

function getCommandArgs(ctx, args = [], extra = '') {
  return `${args.map(arg => ctx.params[arg]).join(' ')} ${extra}`.replace(/\s{2,}/g,' ').trim()
}

function runAndRenderPage(ctx, args = [], extra = '') {
  return `<script>${doCommand.toString()}</script><pre>\n` +
    runAndRender(ctx, args, `${extra} --help`) +
    `\n\n` +
    `<a href='#' onclick="doCommand(event)">run <b>nb.js ${getCommandArgs(ctx, args, extra)}</b></a>` +
    `\n</pre>` +
    `<pre id="output"></pre>`
}

function runAndRender(ctx, args = [], extra = '') {
  let command = `${nb} ${getCommandArgs(ctx, args, extra)}`
  let output
  try {
    output = execSync(command, { encoding: 'utf8' })
  } catch (e) {
    output = e.stdout + e.stderr
  }
  console.log(`> ${command}`)
  console.log(output)
  return `> nb.js ${getCommandArgs(ctx, args, extra)}\n\n`
    + output.replace(/</g, '&#60;').replace(/>/g, '&#62;')
}

const port = 8080

// because we're trying to be shape-agnostic, we don't care what the args are called so long as they exist
// this functions makes handler routes for both the --help and the regular commands for a certain length

// if we have 2 args, that means we need `/nb`, `/nb/arg1`, and `/nb/arg1/arg2`.
// we need to create two methods like this for each of them:
// get('/nb/:arg1/:arg2', ctx => runAndRenderPage(ctx, ["arg1", "arg2"]))
// post('/nb/:arg1/:arg2', ctx => runAndRender(ctx, ["arg1", "arg2"]))

function makeRoutes(root, totalNumberOfArgs = 0) {
  // for each sub-length in the totalNumberOfArgs, make a new set of get/post
  // (e.g. if totalNumberOfArgs === 2, we need to make routes with 0, 1, and 2 args)
  return new Array(totalNumberOfArgs + 1).fill('arg').map((arg, index) => index)
    .map(numberOfArgs => {
      let args = new Array(numberOfArgs).fill('arg').map((arg, index) => arg + index)
      let path = args.map(arg => `:${arg}`).join('/') || ''
      return [
        get(root + (path ? "/" : "") + path, async ctx => runAndRenderPage(ctx, args)),
        post(root + (path ? "/" : "") + path, async ctx => runAndRender(ctx, args))
      ]
    })
    .flat(2)
}

server({ port, security: { csrf: false }}, [
  get('/', ctx => `<a href="nb">nb</a>`),
  
  // handle a given number of args:
  // this is total depth -- right now, this works
  makeRoutes('/nb', 10)
]);

console.log(`Listening on port ${port}...`)