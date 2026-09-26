import { defineConfig } from "vite";
import { remoteConfig } from "@platform/tool-sdk/vite";

export default defineConfig(remoteConfig({ name: "refunds", port: 3002 }));
