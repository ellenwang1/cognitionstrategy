import type { ToolRemote } from "@platform/tool-sdk";

export interface ToolRegistration {
  key: string;
  name: string;
  description: string;
  /** Permission required to see the tool in the nav. */
  permission: string;
  /** Base URL of the tool's API; passed to the remote on mount. */
  apiBaseUrl: string;
  /** Loads the federated remote. Failing loads surface the fallback UI. */
  load: () => Promise<{ default: ToolRemote }>;
}

const env = import.meta.env;

export const TOOLS: ToolRegistration[] = [
  {
    key: "kyc",
    name: "KYC Review Queue",
    description: "Review applicant KYC cases with sanctions screening.",
    permission: "kyc:read",
    apiBaseUrl: env.VITE_KYC_API_URL ?? "http://localhost:8001",
    load: () => import("kyc/Tool"),
  },
  {
    key: "refunds",
    name: "Refunds Dashboard",
    description: "Approve or reject customer refund requests.",
    permission: "refunds:read",
    apiBaseUrl: env.VITE_REFUNDS_API_URL ?? "http://localhost:8002",
    load: () => import("refunds/Tool"),
  },
  {
    key: "flags",
    name: "Feature Flag Admin",
    description: "Manage feature flags and rollout targets.",
    permission: "flags:read",
    apiBaseUrl: env.VITE_FLAGS_API_URL ?? "http://localhost:8003",
    load: () => import("flags/Tool"),
  },
];

export const AUTH_URL: string = env.VITE_AUTH_URL ?? "http://localhost:8000";
