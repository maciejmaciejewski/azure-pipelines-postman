import "./tabContent.scss"

import * as React from "react"
import * as ReactDOM from "react-dom"
import * as SDK from "azure-devops-extension-sdk"

import fetch from "node-fetch"

import { getClient } from "azure-devops-extension-api"
import { ReleaseEnvironment, ReleaseRestClient, ReleaseTaskAttachment } from "azure-devops-extension-api/Release"
import { Build, BuildRestClient, Attachment } from "azure-devops-extension-api/Build"
import { CommonServiceIds, IProjectPageService } from "azure-devops-extension-api"

import { ObservableValue, ObservableObject } from "azure-devops-ui/Core/Observable"
import { Observer } from "azure-devops-ui/Observer"
import { Tab, TabBar, TabSize } from "azure-devops-ui/Tabs"
import { Card } from "azure-devops-ui/Card"

const ATTACHMENT_TYPE = "postman.summary";
const REPORT_ATTACHMENT_TYPE = "postman.report";
const OUR_TASK_IDS = [
  // PROD
  "f5384bf0-1b5c-11ea-b0cc-5b064956a213",
  // Finastra Dev
  "0e9f302d-865d-52f6-aba0-a0e258493f6d"
]

SDK.init()
SDK.ready().then(() => {
  try {
    const config = SDK.getConfiguration()
    if (typeof config.onBuildChanged === "function") {
      config.onBuildChanged((build: Build) => {
        let buildAttachmentClient = new BuildAttachmentClient(build)
        buildAttachmentClient.init().then(() => {
          displayReports(buildAttachmentClient)
        }).catch(error => {setError(error)})
      })
    } else if (typeof config.releaseEnvironment === "object") {
      let releaseAttachmentClient = new ReleaseAttachmentClient(config.releaseEnvironment)
      releaseAttachmentClient.init().then(() => {
        displayReports(releaseAttachmentClient)
      }).catch(error => {setError(error)})
    }
  } catch(error) {
    setError(error)
  }
})

function setText (message: string) {
  console.log(message)
  const messageContainer = document.querySelector("#postman-ext-message p")
  if (messageContainer) {
    messageContainer.innerHTML = message
  }
  const spinner = document.querySelector(".spinner")

}

function setError (error: Error) {
  setText('Error loading reports')
  console.log(error)
  const spinner = document.querySelector(".spinner") as HTMLElement;
  const errorBadge = document.querySelector('.error-badge') as HTMLElement;
  if (spinner && errorBadge) {
    spinner.style.display = 'none';
    errorBadge.style.display = 'block';
  }
}

function displayReports(attachmentClient: AttachmentClient) {
  const nbAttachments = attachmentClient.getAttachments().length
  if (nbAttachments) {
    ReactDOM.render(<TaskAttachmentPanel attachmentClient={attachmentClient} />, document.getElementById("postman-ext-container"))
    document.getElementById("postman-ext-message").style.display = "none"
  } else {
  setError(Error("Can't find any report attachment"))
  }
}

SDK.register("registerRelease", {
  isInvisible: function (state) {
    let resultArray = []
    state.releaseEnvironment.deployPhasesSnapshot.forEach(phase => {
      phase.workflowTasks.forEach(task => {
        resultArray.push(task.taskId)
      })
    })
    return !OUR_TASK_IDS.some(id => resultArray.includes(id))
  }
})

interface ReportCardProps {
  successful: boolean,
  name: string,
  href: string
}

class ReportCard extends React.Component<ReportCardProps> {
  private collapsed = new ObservableValue<boolean>(false);
  private tabInitialContent = '<p>Loading...</p>'
  private content = new ObservableValue<string>(this.tabInitialContent);

  constructor(props: ReportCardProps) {
    super(props);
  }

  // public componentDidMount() {
  // }

  public render() {
    return (
      //<span dangerouslySetInnerHTML={ {__html: this.tabContents.get(props.selectedTabId)} } />
      <Card
        className="flex-grow"
        collapsible={true}
        collapsed={this.collapsed}
        onCollapseClick={this.onCollapseClicked}
        titleProps={{ text: this.props.name }}
      >
        <span dangerouslySetInnerHTML={ {__html: "coucou"} } />
      </Card>
    )
  }

  private onCollapseClicked = () => {
    this.collapsed.value = !this.collapsed.value;
  }
}


interface TaskAttachmentPanelProps {
  attachmentClient: AttachmentClient
}

export default class TaskAttachmentPanel extends React.Component<TaskAttachmentPanelProps> {
  private selectedTabId: ObservableValue<string>
  private tabContents: ObservableObject<JSX.Element>
  private tabInitialContent: JSX.Element = <div className="wide"><p>Loading...</p></div>

  constructor(props: TaskAttachmentPanelProps) {
    super(props);
    this.selectedTabId = new ObservableValue(props.attachmentClient.getAttachments()[0].name)
    this.tabContents = new ObservableObject()
  }

  public componentDidMount() {
    // const config = SDK.getConfiguration()
    // SDK.notifyLoadSucceeded().then(() => {
    //     SDK.resize()
    // });
  }

  public render() {
    const attachments = this.props.attachmentClient.getAttachments()
    if (attachments.length == 0) {
      return (null)
    } else {
      const tabs = []
      for (const attachment of attachments) {
        tabs.push(<Tab name={attachment.name} id={attachment.name} key={attachment.name} url={attachment._links.self.href}/>)
        this.tabContents.add(attachment.name, this.tabInitialContent)
      }
      return (
        <div className="flex-column">
          { attachments.length > 1 ?
            <TabBar
              onSelectedTabChanged={this.onSelectedTabChanged}
              selectedTabId={this.selectedTabId}
              tabSize={TabSize.Tall}
            >
              {tabs}
            </TabBar>
          : null }
          <Observer selectedTabId={this.selectedTabId} tabContents={this.tabContents}>
            {(props: { selectedTabId: string }) => {
              if ( this.tabContents.get(props.selectedTabId) === this.tabInitialContent) {
                this.props.attachmentClient.getReportSummary(props.selectedTabId).then((summary) => {
                  const cards = []
                  for (const reportData of summary) {
                    cards.push(<ReportCard {...reportData} key={reportData.name} />)
                  }
                  const content = <div className="flex-column" style={{ flexWrap: "nowrap" }}>{cards}</div>
                  this.tabContents.set(props.selectedTabId, content)
                }).catch(error => {
                  this.tabContents.set(props.selectedTabId, <div className="wide"><p>Error loading report:<br/>' + error + '</p></div>)
                  setError(error)
                })
              }
              return  this.tabContents.get(props.selectedTabId)
            }}
          </Observer>
        </div>
      );
    }
  }

  private onSelectedTabChanged = (newTabId: string) => {
    this.selectedTabId.value = newTabId;
  }
}

abstract class AttachmentClient {
  protected attachments: Attachment[]  | ReleaseTaskAttachment[] = []
  protected authHeaders: Object = undefined
  protected summaryTemplate: string = undefined
  protected appJsContent: string = undefined
  constructor() {}

  // Retrieve attachments and attachment contents from AzDO
  abstract async init(): Promise<void>

  public getAttachments() : Attachment[]  | ReleaseTaskAttachment[] {
    return this.attachments
  }

  public getDownloadableAttachment(attachmentName: string): Attachment | ReleaseTaskAttachment {
    const attachment = this.attachments.find((attachment) => { return attachment.name === attachmentName})
    if (!(attachment && attachment._links && attachment._links.self && attachment._links.self.href)) {
      throw new Error("Attachment " + attachmentName + " is not downloadable")
    }
    return attachment
  }

  abstract async getReportAttachments(): Promise<Attachment[] | ReleaseTaskAttachment[]>

  public async getReportSummary(attachmentName: string): Promise<ReportCardProps[]> {
    setText('Looking for Summary File')
    if (this.authHeaders === undefined) {
      console.log('Get access token')
      const accessToken = await SDK.getAccessToken()
      const b64encodedAuth = Buffer.from(':' + accessToken).toString('base64')
      this.authHeaders = { headers: {'Authorization': 'Basic ' + b64encodedAuth} }
    }
    console.log("Get " + attachmentName + " attachment content")
    const attachment = this.getDownloadableAttachment(attachmentName)
    const response = await fetch(attachment._links.self.href, this.authHeaders)
    if (!response.ok) {
      throw new Error(response.statusText)
    }
    setText('Processing Summary File')
    const summaryContentJson = JSON.parse(await response.text())
    const reports = await this.getReportAttachments()

    let data = summaryContentJson.map(report => {
      let rp = reports.find(x => x.name === report.name)
      return {
        successful: report.successfull,
        name: report.name,
        href: rp._links.self.href
      }
    })
    return data
  }
}

class BuildAttachmentClient extends AttachmentClient {
  private build: Build

  constructor(build: Build) {
    super()
    this.build = build
  }

  public async init() {
    console.log('Get attachment list')
    const buildClient: BuildRestClient = getClient(BuildRestClient)
    this.attachments = await buildClient.getAttachments(this.build.project.id, this.build.id, ATTACHMENT_TYPE)
  }

  public async getReportAttachments(): Promise<Attachment[]> {
    console.log('Get report list')
    const buildClient: BuildRestClient = getClient(BuildRestClient)
    return await buildClient.getAttachments(this.build.project.id, this.build.id, REPORT_ATTACHMENT_TYPE)
  }
}

  class ReleaseAttachmentClient extends AttachmentClient {
    private releaseEnvironment: ReleaseEnvironment
    private projectId
    private deployStepAttempt
    private runPlanId

    constructor(releaseEnvironment: ReleaseEnvironment) {
      super()
      this.releaseEnvironment = releaseEnvironment
    }

    public async init() {
      const releaseId = this.releaseEnvironment.releaseId
      const environmentId = this.releaseEnvironment.id
      console.log('Get project')
      const projectService = await SDK.getService<IProjectPageService>(CommonServiceIds.ProjectPageService)
      const project = await projectService.getProject()
      console.log('Get release')
      const releaseClient: ReleaseRestClient = getClient(ReleaseRestClient)
      const release = await releaseClient.getRelease(project.id, releaseId)
      const env = release.environments.filter((e) => e.id === environmentId)[0]

      if (!(env.deploySteps && env.deploySteps.length)) {
        throw new Error("This release has not been deployed yet")
      }

      const deployStep = env.deploySteps[env.deploySteps.length - 1]
      if (!(deployStep.releaseDeployPhases && deployStep.releaseDeployPhases.length)) {
        throw new Error("This release has no job");
      }

      const runPlanIds = deployStep.releaseDeployPhases.map((phase) => phase.runPlanId)
      if (!runPlanIds.length) {
        throw new Error("There are no plan IDs");
      } else {
        searchForRunPlanId: {
          for (const phase of deployStep.releaseDeployPhases) {
            for (const deploymentJob of phase.deploymentJobs) {
              for (const task of deploymentJob.tasks){
                if (OUR_TASK_IDS.includes(task.task?.id)) {
                  this.runPlanId = phase.runPlanId;
                  break searchForRunPlanId
                }
              }
            }
          }
        }
      }
      this.projectId = project.id
      this.deployStepAttempt = deployStep.attempt
      console.log('Get attachment list')
      this.attachments = await releaseClient.getReleaseTaskAttachments(project.id, releaseId, environmentId, deployStep.attempt, this.runPlanId, ATTACHMENT_TYPE)
      if (this.attachments.length === 0) {
        throw new Error("There is no attachment")
      }
      if (this.attachments.length >1) {
        throw new Error("There is more than a single attachment, this is not expected")
      }
    }

    public async getReportAttachments(): Promise<ReleaseTaskAttachment[]> {
      console.log('Get report list')
      const releaseClient: ReleaseRestClient = getClient(ReleaseRestClient)
      return await releaseClient.getReleaseTaskAttachments(this.projectId, this.releaseEnvironment.releaseId, this.releaseEnvironment.id, this.deployStepAttempt, this.runPlanId, REPORT_ATTACHMENT_TYPE)
    }

  }
