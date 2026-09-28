import { mountStandalone } from "@platform/tool-sdk";
import remote, { config } from "./remote";

mountStandalone(document.getElementById("root")!, remote, config);
