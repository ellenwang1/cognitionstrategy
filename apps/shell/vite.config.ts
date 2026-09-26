import { defineConfig, loadEnv } from "vite";
import { hostConfig } from "@platform/tool-sdk/vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, ".", "VITE_");
  return hostConfig({
    port: 3000,
    remotes: {
      kyc: env.VITE_KYC_REMOTE ?? "http://localhost:3001/assets/remoteEntry.js",
      refunds: env.VITE_REFUNDS_REMOTE ?? "http://localhost:3002/assets/remoteEntry.js",
      flags: env.VITE_FLAGS_REMOTE ?? "http://localhost:3003/assets/remoteEntry.js",
    },
  });
});
