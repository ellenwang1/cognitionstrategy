import React from "react";
import * as ReactDOM from "react-dom";
import type { Root } from "react-dom/client";
import type { ToolConfig } from "./generated/tool-config";
import type { MountProps, ToolRemote } from "./session";
import { ToolRenderer } from "./ToolRenderer";

// Module Federation only shares bare package specifiers, so `react-dom/client` would
// pull the remote's private react-dom copy. The root export carries createRoot too.
const { createRoot } = ReactDOM as unknown as typeof import("react-dom/client");

const roots = new WeakMap<HTMLElement, Root>();

/**
 * Build the Module Federation `mount`/`unmount` pair a tool remote exposes.
 * A tool frontend is therefore: `export default createToolRemote(config)`.
 */
export function createToolRemote(config: ToolConfig, resolveApiBaseUrl?: () => string | undefined): ToolRemote {
  return {
    mount(el: HTMLElement, props: MountProps) {
      let root = roots.get(el);
      if (!root) {
        root = createRoot(el);
        roots.set(el, root);
      }
      root.render(<ToolRenderer config={config} {...props} apiBaseUrl={props.apiBaseUrl ?? resolveApiBaseUrl?.()} />);
    },
    unmount(el: HTMLElement) {
      roots.get(el)?.unmount();
      roots.delete(el);
    },
  };
}
