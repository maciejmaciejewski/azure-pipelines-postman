# Azure Devops Postman HTML Report

## About

This Azure DevOps extension provides task for Publishing Postman / Newman HTML Reports into built into Azure Storage.

Reports can be viewed as a tab in Build and Release result page. Each Tab contains embeded reports as well as direct download links.

For more info please refer to documentation page on [GitHub](https://github.com/maciejmaciejewski/azure-pipelines-postman)

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
