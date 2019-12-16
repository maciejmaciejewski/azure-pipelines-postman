import TFS_Release_Contracts = require("ReleaseManagement/Core/Contracts");
import TFS_Build_Contracts = require("TFS/Build/Contracts");
import TFS_DistributedTask_Contracts = require("TFS/DistributedTask/Contracts");
import TFS_Build_Extension_Contracts = require("TFS/Build/ExtensionContracts");
import RM_Client = require("ReleaseManagement/Core/RestClient");
import DT_Client = require("TFS/DistributedTask/TaskRestClient");
import Controls = require("VSS/Controls");
// @ts-ignore
import mustache = require("mustache");

abstract class BasePostmanReportTab extends Controls.BaseControl {
    supportingTaskId: string = 'f5384bf0-1b5c-11ea-b0cc-5b064956a213';
    attachmentName: string = 'summary.json'
    reportAttachmentType: string = "postman.report"
    summaryAttachmentType: string = "postman.summary"

    protected constructor() {
      super();
    }

    protected convertBufferToString(buffer: ArrayBuffer): string {
      const enc = new TextDecoder("utf-8");
      const arr = new Uint8Array(buffer);
      return enc.decode(arr);
    }

    protected setFrameHtmlContent(htmlStr: string) {
      const htmlContainer = this.getElement().get(0);
      const frame = htmlContainer.querySelector("#postman-result") as HTMLIFrameElement;
      const waiting = htmlContainer.querySelector("#waiting") as HTMLElement;

      if (htmlStr && frame && waiting) {
        frame.srcdoc = htmlStr;
        waiting.style.display = "none";
        frame.style.display = "block";
      }
    }

    protected setTabText (message: string) {
      const htmlContainer = this.getElement().get(0)
      htmlContainer.querySelector("#waiting p").innerHTML = message
    }

    protected async fetchResource (url: string) : Promise<string> {
      const resource = await fetch(url)
      const text = await resource.text()

      return text
    }

    protected async setErrorBadge (errorMessage: string) {
      const container = this.getElement().get(0);
      const spinner = container.querySelector(".spinner") as HTMLElement;
      const errorBadge = container.querySelector('.error-badge') as HTMLElement;
      if (spinner && errorBadge) {
        spinner.style.display = 'none';
        errorBadge.style.display = 'block';
      }
      this.setTabText(errorMessage)
    }
  }

  class BuildPostmanReportTab extends BasePostmanReportTab {
    config: TFS_Build_Extension_Contracts.IBuildResultsViewExtensionConfig = VSS.getConfiguration()
    hubName: string = "build"

    constructor() {
      super()
    }

    public initialize(): void {
      super.initialize();

      this.config.onBuildChanged((build: TFS_Build_Contracts.Build) => {
        this.findAttachment(build)
      })
    }

    private async findAttachment(build: TFS_Build_Contracts.Build)  {
      try{
        let response = await fetch('./template.html')
        let htmlTemplate = await response.text()

        this.setTabText('Looking for Report File')
        const vsoContext: WebContext = VSS.getWebContext();
        const taskClient: DT_Client.TaskHttpClient = DT_Client.getClient();
        const projectId = vsoContext.project.id;
        const planId = build.orchestrationPlan.planId;

        const postmanReports = await taskClient.getPlanAttachments(projectId, this.hubName, planId, this.reportAttachmentType)
        const postmanSummary = (await taskClient.getPlanAttachments(projectId, this.hubName, planId, this.summaryAttachmentType)).find(attachment => attachment.name === this.attachmentName)

        this.setTabText('Processing Report')
        const summaryContent = await taskClient.getAttachmentContent(projectId, this.hubName, planId, postmanSummary.timelineId, postmanSummary.recordId, this.summaryAttachmentType, postmanSummary.name)
        const summaryContentJson = JSON.parse(this.convertBufferToString(summaryContent))

        let data = {
          links: summaryContentJson.map(report => {
            let rp = postmanReports.find(x => x.name === report.name)

            return {
              class: report.successfull ? 'table-success' : 'table-danger',
              name: report.name,
              href: rp._links.self.href
            }
          })
        }

        const renderedTemplate = mustache.render(htmlTemplate, data)
        this.setFrameHtmlContent(renderedTemplate)
      } catch (err) {
        console.log(err)
        this.setErrorBadge('Failed to load Postman Report')
      }
    }
  }


class ReleasePosmanReportTab extends BasePostmanReportTab {
  environment: TFS_Release_Contracts.ReleaseEnvironment
  attachmentType: string = "protractor.report"
  attachmentName: string = "protractor_report.json"
  screenshotAttachmentType: string = "protractor.screenshot"

  constructor() {
    super();
  }

  public initialize(): void {
    super.initialize();
    this.environment =  VSS.getConfiguration().releaseEnvironment
    this.findfindAttachment(this.environment.releaseId, this.environment.id)
  }

  private async findfindAttachment(releaseId, environmentId) {
    const template = await this.fetchResource('./template.html')

    this.setTabText('Looking for Report File')
    const vsoContext: WebContext = VSS.getWebContext();
    const rmClient = RM_Client.getClient() as RM_Client.ReleaseHttpClient;
    const release = await rmClient.getRelease(vsoContext.project.id, releaseId);
    const env = release.environments.find((env) => env.id === environmentId);

    try {
      if (!(env.deploySteps && env.deploySteps.length)) {
        throw new Error("This release has not been deployed yet");
      }

      const deployStep = env.deploySteps[env.deploySteps.length - 1];
      if (!(deployStep.releaseDeployPhases && deployStep.releaseDeployPhases.length)) {
        throw new Error("This release has no job");
      }

      const runPlanIds = deployStep.releaseDeployPhases.map((phase) => phase.runPlanId);
      let runPlanId = null;
      if (!runPlanIds.length) {
        throw new Error("There are no plan IDs");
      } else {
        searchForRunPlanId: {
          for (const phase of deployStep.releaseDeployPhases) {
            for (const deploymentJob of phase.deploymentJobs){
              for (const task of deploymentJob.tasks){
                if (typeof task.task !== 'undefined' && task.task.id === this.supportingTaskId){
                  runPlanId = phase.runPlanId;
                  break searchForRunPlanId;
                }
              }
            }
          }
        }
      }

      const postmanReports = await rmClient.getTaskAttachments(
        vsoContext.project.id,
        env.releaseId,
        env.id,
        deployStep.attempt,
        runPlanId,
        this.reportAttachmentType,
      )

      const postmanSummary = (await rmClient.getTaskAttachments(
        vsoContext.project.id,
        env.releaseId,
        env.id,
        deployStep.attempt,
        runPlanId,
        this.summaryAttachmentType,
      )).find(attachment => attachment.type === this.summaryAttachmentType)


      const summaryContent = await rmClient.getTaskAttachmentContent(
        vsoContext.project.id,
        env.releaseId,
        env.id,
        deployStep.attempt,
        runPlanId,
        postmanSummary.recordId,
        this.summaryAttachmentType,
        postmanSummary.name,
      )

      const summaryContentJson = JSON.parse(this.convertBufferToString(summaryContent))
      console.log(summaryContentJson)

      let data = {
        links: summaryContentJson.map(report => {
          let rp = postmanReports.find(x => x.name === report.name)

          return {
            class: report.successfull ? 'table-success' : 'table-danger',
            name: report.name,
            href: rp._links.self.href
          }
        })
      }

      const renderedTemplate = mustache.render(template, data)
      this.setFrameHtmlContent(renderedTemplate)
    } catch (err) {
      this.setErrorBadge(err.message)
    }
  }
}

const htmlContainer = document.getElementById("container");
const vssConfiguration = VSS.getConfiguration();

console.log(vssConfiguration)

if (typeof vssConfiguration.onBuildChanged === "function") {
  BuildPostmanReportTab.enhance(BuildPostmanReportTab, htmlContainer, {});
} else if (typeof VSS.getConfiguration().releaseEnvironment === "object") {
  ReleasePosmanReportTab.enhance(ReleasePosmanReportTab, htmlContainer, {});
}
