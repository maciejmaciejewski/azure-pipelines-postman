# WORK IN PROGRESS

Due to access restrictions this extension had to be published, however currently it is under heavy development so you might expect some issues.

## About

This Azure DevOps extension provides task for Publishing Postman / Newman HTML Reports into built into Azure Storage.

Those reports, that would normally end up on agent's file system, can be viewed as a tab in Build and Release result pages. As for now it contains a simple page that gathers all the reports and provides direct access links.

## Configuration

In order to use this extension first add `Upload Postman HTML Report` task to your pipeline. In your Postman / Newman execution task add `htmlextra` reporter that will generate `HTML` reports.

This tasks requires only one parameter which is path to the location where HTML reports are stored.

![](./docs/postman-report-2.png)

## Example

### Report summary on build tab

![](./docs/postman-report-1.png)
