import type { ToolConfig } from "./generated/tool-config";

/**
 * Cheap structural checks that catch the config mistakes the type system
 * cannot (references to unknown fields). Full validation lives in
 * `platform_core.config` (Pydantic) and runs on the backend.
 */
export function validateToolConfig(config: ToolConfig): string[] {
  const errors: string[] = [];
  const names = new Set(config.entity.fields.map((f) => f.name));
  const check = (where: string, name: string) => {
    if (!names.has(name)) errors.push(`${where}: unknown field "${name}"`);
  };
  config.listView.columns.forEach((c) => check("listView.columns", c));
  (config.listView.filters ?? []).forEach((f) => check("listView.filters", f.field));
  if (config.listView.defaultSort) check("listView.defaultSort", config.listView.defaultSort.field);
  config.detailView.sections.forEach((s) => s.fields.forEach((f) => check(`detailView.${s.title}`, f)));
  (config.actions ?? []).forEach((a) => {
    (a.fields ?? []).forEach((f) => check(`actions.${a.key}.fields`, f));
    if (a.approval?.field) check(`actions.${a.key}.approval`, a.approval.field);
  });
  if (config.entity.statusField) check("entity.statusField", config.entity.statusField);
  check("entity.titleField", config.entity.titleField ?? "id");
  return errors;
}
