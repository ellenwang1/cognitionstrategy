import type { UserConfig } from "vite";

export const SHARED_REACT_VERSION: string;
export function sharedDeps(): Record<string, { singleton: boolean; requiredVersion?: string }>;
export function remoteConfig(opts: { name: string; port: number; expose?: string }): UserConfig;
export function hostConfig(opts: { port: number; remotes: Record<string, string> }): UserConfig;
