const tl = require('azure-pipelines-task-lib/task')
const { resolve, basename, join } = require('path')
const globby = require('globby')
const { readFileSync, writeFileSync } = require('fs')
const { load } = require('cheerio')
const forbiddenKeys = ['password', 'client_secret', 'access_token', 'refresh_token']
const template = /Failed Tests ([0-9]*)/
const dashify = require('dashify')
const hat = require('hat')

function run () {
  let cwd = resolve(tl.getPathInput('cwd', true))

  let files = globby.sync([cwd.replace(/\\/g, '/')], {expandDirectories : {files: ['*'], extensions: ['html']}})

  const fileProperties = []

  files.forEach(file => {
    tl.debug(`Reading report ${file}`)
    const fileContent = readFileSync(file).toString()
    const document = load(fileContent)

    tl.debug(`Anonimizing report`)
    // Anonimize Report
    removeTokenFromHeader(document)
    removeForbiddenKeys(document, "h5:contains('Request Body')")
    removeForbiddenKeys(document, "h5:contains('Response Body')")
    writeFileSync(file, document.html())

    tl.debug(`Uploading report`)
    const attachmentProperties = {
      name: generateName(),
      type: 'postman.report',
      successfull: checkIfSuccessful(document)
    }

    fileProperties.push(attachmentProperties)
    tl.command('task.addattachment', attachmentProperties, file)
  })

  const summaryPath = resolve(join(cwd,'summary.json'))
  writeFileSync(summaryPath, JSON.stringify(fileProperties))

  tl.command('task.addattachment', { name: generateName(), type: 'postman.summary'}, summaryPath)
}

function generateName () {
  const jobName = dashify(tl.getVariable('Agent.JobName'))
  const stageName = dashify(tl.getVariable('System.StageDisplayName'))
  const stageAttempt = tl.getVariable('System.StageAttempt')
  const tabName = tl.getInput('tabName', false ) || 'Postman'
  const uniqueId = hat()

  return `${tabName}.${jobName}.${stageName}.${stageAttempt}.${uniqueId}`
}

function removeTokenFromHeader (document) {
  document(`td:contains('Bearer')`).replaceWith('<td>Bearer ***</td>')
}

function checkIfSuccessful (document) {
  const text = document("div.card-header").find("a:contains('Failed Tests')").text()
  const result = new Number(text.match(template)[1])
  return result > 0 ? false : true
}

function removeForbiddenKeys (document, selector) {
  document(selector).nextAll().find(document('code')).each(function (x, y) {
    const body = document(this).text()

    try {
      const ob = JSON.parse(body)

      Object.keys(ob).forEach((k) => {
        if (forbiddenKeys.includes(k)) {
          ob[k] = '***'
        }
      })

      const attributesObj = document(this).attr()
      const attributes = Object.keys(attributesObj).map(key => {
        return `${key}="${attributesObj[key]}"`
      }).join(' ')

      document(this).replaceWith(`<code ${attributes}>${JSON.stringify(ob, null, 2)}</code>`)
    } catch (error) {
      // Skip if data is non JSON
    }
  })
}

run()
