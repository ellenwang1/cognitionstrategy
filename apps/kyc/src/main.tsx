import { mountStandalone } from "@platform/tool-sdk";
import "@platform/ui-kit/styles.css";
import remote, { config } from "./remote";

mountStandalone(document.getElementById("root")!, remote, config);
