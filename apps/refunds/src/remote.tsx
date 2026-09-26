import { createToolRemote, type ToolConfig } from "@platform/tool-sdk";
import "@platform/ui-kit/styles.css";
import rawConfig from "../../../services/refunds/tool.yaml";

export const config = rawConfig as ToolConfig;

/** The Module Federation surface of this tool: `mount` / `unmount`. */
export default createToolRemote(config, () => import.meta.env.VITE_API_URL);
