import preset from "@platform/ui-kit/tailwind.preset";

export default {
  presets: [preset],
  content: [
    "./index.html",
    "./src/**/*.{ts,tsx}",
    "../../packages/ui-kit/src/**/*.{ts,tsx}",
    "../../packages/tool-sdk/src/**/*.{ts,tsx}",
  ],
};
