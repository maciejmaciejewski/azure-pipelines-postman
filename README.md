# Azure Devops Postman HTML Report

## About

This Azure DevOps extension provides task for Publishing Postman / Newman HTML Reports into built into Azure Storage.

Reports can be viewed as a tab in Build and Release result pages.
Tab contains embeded reports as well as direct download links.

## Configuration

In order to use this extension first add `Upload Postman HTML Report` task to your pipeline. In your Postman / Newman execution task add `htmlextra` reporter that will generate `HTML` reports.

This tasks takes two parameters - required `cwd` which is path to the location where Postman / Newman HTML reports are stored and also optional `tabName` which is the name of the tab displayed within Azure DevOps report.

```YAML
steps:
- task: UploadPostmanHtmlReport@1
  displayName: 'Upload Postman Html Report'
  inputs:
    cwd: '$(System.DefaultWorkingDirectory)'
    tabName: 'Postman Test'
```

![](./docs/postman-report-2.png)

## Example

### Report summary on build tab

![](./docs/postman-report-1.png)

## Contributors
<!-- prettier-ignore-start -->
<!-- markdownlint-disable -->
<table>
  <tr>
      <td align="center">
      <a href="https://github.com/maciejmaciejewski">
        <img src="https://avatars1.githubusercontent.com/u/15831316?v=4" width="100px;" alt=""/>
        <br />
        <b>Maciej Maciejewski</b>
    </td>
    <td align="center">
      <a href="https://github.com/afeblot">
        <img src="https://avatars1.githubusercontent.com/u/12073123?v=4" width="100px;" alt=""/>
        <br />
        <b>Alexandre Feblot</b>
    </td>
  </tr>
</table>
<!-- markdownlint-enable -->
<!-- prettier-ignore-end -->