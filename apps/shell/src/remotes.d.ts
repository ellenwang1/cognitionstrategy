declare module "*/Tool" {
  import type { ToolRemote } from "@platform/tool-sdk";
  const remote: ToolRemote;
  export default remote;
}
