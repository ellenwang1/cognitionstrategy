/** Session contract shared between the shell host and every tool remote. */
export interface Principal {
  id: string;
  email: string;
  name: string;
  roles: string[];
  permissions: string[];
}

export interface Session {
  token: string;
  principal: Principal;
}

export function hasPermission(principal: Principal | null | undefined, permission: string): boolean {
  if (!principal) return false;
  if (principal.permissions.includes("*") || principal.permissions.includes(permission)) return true;
  const prefix = permission.split(":")[0];
  return principal.permissions.includes(`${prefix}:*`);
}

/** Props the shell passes to a remote's `mount(el, props)`. */
export interface MountProps {
  session: Session;
  /** Override for the tool's API base URL (defaults to config.api.baseUrl). */
  apiBaseUrl?: string;
  onSessionExpired?: () => void;
}

export interface ToolRemote {
  mount: (el: HTMLElement, props: MountProps) => void;
  unmount: (el: HTMLElement) => void;
}
