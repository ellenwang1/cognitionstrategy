import react from "@vitejs/plugin-react";
import federation from "@originjs/vite-plugin-federation";
import yaml from "@rollup/plugin-yaml";

/** Pinned versions every host and remote must agree on. */
export const SHARED_REACT_VERSION = "18.3.1";

/** Module Federation `shared` block: single React + `@platform/ui-kit` singleton. */
export function sharedDeps() {
  return {
    react: { singleton: true, requiredVersion: SHARED_REACT_VERSION },
    "react-dom": { singleton: true, requiredVersion: SHARED_REACT_VERSION },
    "@platform/ui-kit": { singleton: true },
  };
}

/**
 * Vite config for a tool remote. Each tool exposes `./Tool` (a `ToolRemote`
 * with `mount`/`unmount`) and nothing else.
 *
 * @param {{ name: string; port: number; expose?: string }} opts
 */
export function remoteConfig({ name, port, expose = "./src/remote.tsx" }) {
  return {
    plugins: [
      react(),
      yaml(),
      federation({
        name,
        filename: "remoteEntry.js",
        exposes: { "./Tool": expose },
        shared: sharedDeps(),
      }),
    ],
    server: { port, strictPort: true, cors: true },
    preview: { port, strictPort: true, cors: true },
    build: { target: "esnext", modulePreload: false, minify: false, cssCodeSplit: false },
  };
}

/**
 * Vite config for the shell host.
 *
 * @param {{ port: number; remotes: Record<string, string> }} opts
 */
export function hostConfig({ port, remotes }) {
  return {
    plugins: [react(), federation({ name: "shell", remotes, shared: sharedDeps() })],
    server: { port, strictPort: true },
    preview: { port, strictPort: true },
    build: { target: "esnext", modulePreload: false, minify: false, cssCodeSplit: false },
  };
}
