import TFS_Release_Contracts = require("ReleaseManagement/Core/Contracts");
import TFS_Build_Contracts = require("TFS/Build/Contracts");
import TFS_DistributedTask_Contracts = require("TFS/DistributedTask/Contracts");
import TFS_Build_Extension_Contracts = require("TFS/Build/ExtensionContracts");
import RM_Client = require("ReleaseManagement/Core/RestClient");
import DT_Client = require("TFS/DistributedTask/TaskRestClient");
import Controls = require("VSS/Controls");
// @ts-ignore
import mustache = require("mustache");

abstract class BaseProtractorReportTab extends Controls.BaseControl {
    protected static readonly ATTACHMENT_TYPE = "finastra.protractor_report";

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
      const frame = htmlContainer.querySelector("#protractor-result") as HTMLIFrameElement;
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

  class BuildProtractorReportTab extends BaseProtractorReportTab {
    config: TFS_Build_Extension_Contracts.IBuildResultsViewExtensionConfig = VSS.getConfiguration()
    hubName: string = "build"
    attachmentType: string = "postman.report"
    // attachmentName: string = "protractor_report.json"

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

        console.log(htmlTemplate)

        this.setTabText('Looking for Report File')
        const vsoContext: WebContext = VSS.getWebContext();
        const taskClient: DT_Client.TaskHttpClient = DT_Client.getClient();
        const projectId = vsoContext.project.id;
        const planId = build.orchestrationPlan.planId;

        const postmanReports = await taskClient.getPlanAttachments(projectId, this.hubName, planId, this.attachmentType)
        console.log(postmanReports)

        let data = {
          links: postmanReports.map(report => {
            return {
              name: report.name,
              href: report._links.self.href
            }
          })
        }

        console.log(data)
        const renderedTemplate = mustache.render(htmlTemplate, data)
        console.log(renderedTemplate)
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
        this.setTabText('Failed to load Protractor Report')
      }
    }
  }

const htmlContainer = document.getElementById("container");

if (typeof VSS.getConfiguration().onBuildChanged === "function") {
  BuildProtractorReportTab.enhance(BuildProtractorReportTab, htmlContainer, {});
} 
// else if (typeof VSS.getConfiguration().releaseEnvironment === "object") {
//   ReleaseProtractorReportTab.enhance(ReleaseProtractorReportTab, htmlContainer, {});
// }

