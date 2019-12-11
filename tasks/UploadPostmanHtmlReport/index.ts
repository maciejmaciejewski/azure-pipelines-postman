import * as tl from 'azure-pipelines-task-lib/task'
import { resolve, basename } from 'path'
import * as globby from 'globby'
import { readFileSync, writeFileSync } from 'fs'
import { load } from 'cheerio'
const forbidenKeys = ['password', 'client_secret', 'access_token', 'refresh_token']




async function run () : Promise<void> {
  let cwd = resolve(tl.getPathInput('cwd', true))
  let templateFile = readFileSync('template.html')

  const templateProperties = {
    name: 'template.html',
    type: 'postman.template'
  }

  tl.command('task.addattachment', templateProperties, './template.html')


  globby([`${cwd}/*.html`]).then(files => {
    files.forEach(file => {
      tl.debug(`Reading report ${file}`)
      const fileContent = readFileSync(file).toString()
      const document = load(fileContent)

      tl.debug(`Anonimizing report`)
      // Anonimize Report
      removeTokenFromHeader(document)
      removeForbidenKeys(document, "h5:contains('Request Body')")
      removeForbidenKeys(document, "h5:contains('Response Body')")
      writeFileSync(file, document.html())

      tl.debug(`Uploading report`)
      const attachmentProperties = {
        name: basename(file),
        type: 'postman.report'
      }

      tl.command('task.addattachment', attachmentProperties, file)
    })
  })
}

function removeTokenFromHeader (document) {
  document(`td:contains('Bearer')`).replaceWith('<td>Bearer ***</td>')
}

function removeForbidenKeys (document, selector) {
  document(selector).nextAll().find(document('code')).each(function (x, y) {
    const body = document(this).text()

    try {
      const ob = JSON.parse(body)

      Object.keys(ob).forEach((k) => {
        if (forbidenKeys.includes(k)) {
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