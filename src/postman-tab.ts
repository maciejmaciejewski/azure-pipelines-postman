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
  }

  class BuildPostmanReportTab extends BasePostmanReportTab {
    config: TFS_Build_Extension_Contracts.IBuildResultsViewExtensionConfig = VSS.getConfiguration()
    hubName: string = "build"
    attachmentName: string = 'summary.json'
    reportAttachmentType: string = "postman.report"
    summaryAttachmentType: string = "postman.summary"

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
        const container = this.getElement().get(0);
        const spinner = container.querySelector(".spinner") as HTMLElement;
        const errorBadge = container.querySelector('.error-badge') as HTMLElement;
        if (spinner && errorBadge) {
          spinner.style.display = 'none';
          errorBadge.style.display = 'block';
        }
        this.setTabText('Failed to load Postman Report')
      }
    }
  }

const htmlContainer = document.getElementById("container");
const vssConfiguration = VSS.getConfiguration();

console.log(vssConfiguration)

if (typeof vssConfiguration.onBuildChanged === "function") {
  BuildPostmanReportTab.enhance(BuildPostmanReportTab, htmlContainer, {});
} 
// else if (typeof VSS.getConfiguration().releaseEnvironment === "object") {
//   ReleaseProtractorReportTab.enhance(ReleaseProtractorReportTab, htmlContainer, {});
// }

