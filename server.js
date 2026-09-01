import { execSync } from 'child_process'
import path from 'path'
import { fileURLToPath } from 'url'

import flatfile from 'flat-file-db'  // docs: https://github.com/mafintosh/flat-file-db#api

import server from 'server'
const { get, post } = server.router

const __dirname = path.dirname(fileURLToPath(import.meta.url))
let nb = path.resolve(__dirname, 'nb.js')

const db = flatfile.sync(path.join(__dirname, 'server-config.db'))

function injectScripts(...fns) {
  return `<script>${fns.map(fn => {
    if (typeof fn === 'function') return fn.toString()
    else return fn
  }).join(';')}</script>`
}

function sanitizeHtml(input) {
  return input.replace(/</g, '&#60;').replace(/>/g, '&#62;')
}

function runAndRenderPage(ctx, commandString) {
  return `<body style="font-size: 13px; margin: 0px;">`
    + '<div style="position: sticky; background: white; top: 0px; padding: 1.3em 10px 0px 10px;">'
    + form(`> nb.js `, sanitizeHtml(commandString))
    + '<hr style="border: 0; border-top: 0.5px solid gray; margin: 1.5em 0px;"/>'
    + `</div>`
    + `<pre id="output" style="margin: 10px;">${formatCommandOutput(ctx, commandString, sanitizeHtml(runCommand(ctx, commandString)))}</pre>`
    + `</body>`
}

function form(prefix, defaultValue) {
  function onInput(value) {
    document.querySelector('#spacer').innerHTML = ` ${value} `
  }

  async function doCommand(event, link) {
    event.preventDefault()
    let command = link || event.target[0].value
    let outputElement = document.querySelector('#output')
    window.history.pushState({}, '', encodeURIComponent(command))

    document.querySelector('#command-input').value = command
    onInput(command)

    let text = await (await fetch(`/nb/${encodeURIComponent(command)}`, { method: 'POST' })).text()
    outputElement.innerHTML = formatCommandOutput({}, command, text) + '\n\n' + outputElement.innerHTML
  }

  // this hack makes the cursor move to the end of the text on focus
  function onFocus(event) {
    let val = event.target.value
    event.target.value = ''
    event.target.value = val
  }

  function addListeners() {
    window.addEventListener('keydown', (event) => {
      console.log(event)
      if (
        event.key.match(/^[a-zA-Z0-9]$/) 
        && event.altKey === false
        && event.metaKey === false
        && event.ctrlKey === false
        && event.shiftKey === false
      ) {
        document.querySelector('#command-input').focus()
      }
    })
  }

  let formStyle = `style="white-space: normal; font-family: monospace;" `
  let spanStyle = `style="white-space: pre;" `
  let wrapperStyle = `style="position: relative; display: inline-block;" `
  let inputStyle = `style="position: absolute; width: 100%; left: 0; border: 0; padding: 0; margin: 0; font-family: inherit; font-size: inherit; text-align: center;" `

  return `${injectScripts(onInput, doCommand, onFocus, `(${addListeners.toString()}())`, formatCommandOutput, sanitizeHtml)}
  <form ${formStyle} onsubmit="doCommand(event)">
    <span ${spanStyle}>${prefix.trim()}</span><span ${wrapperStyle}>
      <span id="spacer" ${spanStyle}> ${defaultValue} </span>
      <input id="command-input" ${inputStyle} oninput="onInput(event.target.value)" onfocus="onFocus(event)" value="${defaultValue.replace(/"/g,'\\"')}"></input>
    </span><span ${spanStyle}></span>
  </form>`
}

function formatCommandOutput(ctx, command, input) {
  let isInCommandSection = false
  let commandRegExp = /(nb\.js)\s+((?:(?!&|<|\[|  ).)+)\s/

  function makeLink(link, text, help = true) {
    return `<a href="/nb/${link}${help ? ' --help' : ""}" onclick="doCommand(event, '${link}${help ? ' --help' : ""}')">${text}</a>`
  }

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
            parsedLine += `${makeLink(itemsSoFar.join(' '), item)} `
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
        return line.replace(commandRegExp, `$1 ${makeLink('$2', '$2')} `)
      }

      else if (isInCommandSection && !line.startsWith('  ')) {
        isInCommandSection = false
      }

      return line
    })
  return `> nb.js ${sanitizeHtml(command)}    ${makeLink(command, '(repeat)', false)}\n\n` + lines.join("\n")
}

function runCommand(ctx, commandString) {
  let command = `${nb} ${commandString.split(/\s/)
    // best effort safety -- wrap all args in single quotes
    .map(part => `'${part.replace(/'/g, "'\\''")}'`).join(' ')}`
  let output
  try {
    output = execSync(command, { encoding: 'utf8' })
  } catch (e) {
    output = e.stdout + e.stderr
  }
  
  console.log(`> ${command}`)
  console.log(output)

  return output
}

function getCommand(ctx) {
  let commandString = ctx.params.command

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
          return `- <a href="nb/${key} --help">${key}</a>`
        })
        .join('<br />')
    }

    return `<a href="nb/--help">nb</a><br />${recentsText}`
  }),
  
  get('/nb', ctx => runAndRenderPage(ctx, '')),
  post('/nb', ctx => server.reply
    .type("text/plain")
    .send(runCommand(ctx, ''))),

  get('/nb/:command', ctx => runAndRenderPage(ctx, getCommand(ctx))),
  post('/nb/:command', ctx => {
    return server.reply
    .type("text/plain")
    .send(runCommand(ctx, getCommand(ctx)))}
  )
],
  server.router.error(ctx => {
    console.log(ctx.error)
    return server.reply.status(500).send(ctx.error.message)
  })
);

console.log(`Listening on http://localhost:${port}`)