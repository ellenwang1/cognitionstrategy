import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  ApprovalWidget,
  AuditTrail,
  Button,
  Checkbox,
  DataTable,
  DetailPane,
  FilterBar,
  FormField,
  Modal,
  QueueView,
  Select,
  Spinner,
  StatusBadge,
  TextArea,
  TextInput,
  formatValue,
  type ApprovalItem,
  type AuditEntry,
  type Column,
  type SortState,
  type ValueType,
} from "@platform/ui-kit";
import type { ActionSpec, EntityField, ToolConfig } from "./generated/tool-config";
import { ApiError, ToolApiClient, type Entity } from "./api";
import { hasPermission, type MountProps } from "./session";

export interface ToolRendererProps extends MountProps {
  config: ToolConfig;
}

const fieldMap = (config: ToolConfig) => new Map(config.entity.fields.map((f) => [f.name, f]));

function renderField(field: EntityField | undefined, value: unknown, row?: Entity) {
  const type = (field?.type ?? "string") as ValueType;
  const currency = row && typeof row.currency === "string" ? row.currency : undefined;
  return formatValue(value, type, { currency });
}

/**
 * Turns a `ToolConfig` into a working master/detail tool: list or queue view,
 * filters, detail pane, permission-aware actions, approvals and audit trail.
 */
export function ToolRenderer({ config, session, apiBaseUrl, onSessionExpired }: ToolRendererProps) {
  const api = useMemo(
    () => ToolApiClient.forConfig(config, apiBaseUrl ?? config.api.baseUrl, () => session.token),
    [config, apiBaseUrl, session.token],
  );
  const fields = useMemo(() => fieldMap(config), [config]);
  const idField = config.entity.idField ?? "id";
  const statusField = config.entity.statusField ?? undefined;

  const [items, setItems] = useState<Entity[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [sort, setSort] = useState<SortState | null>(
    config.listView.defaultSort ? { field: config.listView.defaultSort.field, direction: config.listView.defaultSort.direction ?? "desc" } : null,
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Entity | null>(null);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [approvals, setApprovals] = useState<ApprovalItem[]>([]);
  const [pendingAction, setPendingAction] = useState<ActionSpec | null>(null);
  const [notice, setNotice] = useState<{ tone: "success" | "info" | "error"; text: string } | null>(null);

  const handleError = useCallback(
    (e: unknown) => {
      if (e instanceof ApiError && e.status === 401) onSessionExpired?.();
      setError(e instanceof Error ? e.message : String(e));
    },
    [onSessionExpired],
  );

  const pageSize = config.listView.pageSize ?? 25;

  const refreshList = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.list({ page, pageSize, search, filters, sort: sort?.field, direction: sort?.direction });
      setItems(res.items);
      setTotal(res.total);
    } catch (e) {
      handleError(e);
    } finally {
      setLoading(false);
    }
  }, [api, page, pageSize, search, filters, sort, handleError]);

  const refreshSelected = useCallback(
    async (id: string) => {
      try {
        const [entity, trail, approvalList] = await Promise.all([
          api.get(id),
          config.detailView.showAuditTrail !== false ? api.audit(id) : Promise.resolve([]),
          config.detailView.showApprovals !== false ? api.approvalsFor(id) : Promise.resolve([]),
        ]);
        setSelected(entity);
        setAudit(trail as unknown as AuditEntry[]);
        setApprovals(approvalList as unknown as ApprovalItem[]);
      } catch (e) {
        handleError(e);
      }
    },
    [api, config, handleError],
  );

  useEffect(() => {
    void refreshList();
  }, [refreshList]);

  useEffect(() => {
    if (selectedId) void refreshSelected(selectedId);
    else {
      setSelected(null);
      setAudit([]);
      setApprovals([]);
    }
  }, [selectedId, refreshSelected]);

  const runAction = async (action: ActionSpec, payload: Record<string, unknown>, reason: string) => {
    if (!selectedId) return;
    setNotice(null);
    try {
      const res = await api.act(selectedId, action.key, payload, reason);
      setNotice(
        res.status === "pending_approval"
          ? { tone: "info", text: `"${action.label}" requires approval — request submitted.` }
          : { tone: "success", text: `"${action.label}" applied.` },
      );
      setPendingAction(null);
      await Promise.all([refreshSelected(selectedId), refreshList()]);
    } catch (e) {
      setNotice({ tone: "error", text: e instanceof Error ? e.message : String(e) });
    }
  };

  const decide = async (approval: ApprovalItem, decision: "approved" | "rejected", comment: string) => {
    setNotice(null);
    try {
      await api.decide(approval.id, decision, comment);
      setNotice({ tone: "success", text: `Request ${decision}.` });
      if (selectedId) await Promise.all([refreshSelected(selectedId), refreshList()]);
    } catch (e) {
      setNotice({ tone: "error", text: e instanceof Error ? e.message : String(e) });
    }
  };

  const columns: Column<Entity>[] = config.listView.columns.map((name) => ({
    key: name,
    label: fields.get(name)?.label ?? name,
    render: (row) => renderField(fields.get(name), row[name], row),
  }));

  const visibleActions = (config.actions ?? []).filter((a) => hasPermission(session.principal, a.permission));

  const listPane =
    config.listView.mode === "queue" ? (
      <QueueView
        items={items.map((row) => ({
          key: String(row[idField]),
          title: String(row[config.entity.titleField ?? idField] ?? row[idField]),
          status: statusField ? <StatusBadge value={row[statusField]} /> : undefined,
          meta: config.listView.columns
            .filter((c) => c !== (config.entity.titleField ?? idField) && c !== statusField)
            .map((c) => ({ label: fields.get(c)?.label ?? c, value: renderField(fields.get(c), row[c], row) })),
        }))}
        selectedKey={selectedId}
        onSelect={setSelectedId}
        loading={loading}
        pagination={{ page, pageSize, total, onPageChange: setPage }}
      />
    ) : (
      <DataTable
        columns={columns}
        rows={items}
        rowKey={(row) => String(row[idField])}
        selectedKey={selectedId}
        onRowClick={(row) => setSelectedId(String(row[idField]))}
        sort={sort}
        onSortChange={(s) => {
          setSort(s);
          setPage(1);
        }}
        loading={loading}
        pagination={{ page, pageSize, total, onPageChange: setPage }}
      />
    );

  return (
    <div className={selected ? "grid gap-4 lg:grid-cols-[1fr_minmax(0,420px)]" : "grid gap-4"}>
      <div className="grid min-w-0 gap-3">
        <FilterBar
          filters={(config.listView.filters ?? []).map((f) => ({ field: f.field, label: f.label, kind: f.kind ?? "search", options: f.options }))}
          values={filters}
          onChange={(v) => {
            setFilters(v);
            setPage(1);
          }}
          search={search}
          onSearchChange={(v) => {
            setSearch(v);
            setPage(1);
          }}
          searchPlaceholder={`Search ${config.entity.pluralLabel.toLowerCase()}…`}
        />
        {error ? <Alert tone="error">{error}</Alert> : null}
        {listPane}
      </div>
      {selected ? (
        <div className="min-w-0">
          <DetailPane
            title={String(selected[config.entity.titleField ?? idField] ?? "")}
            status={statusField ? <StatusBadge value={selected[statusField]} /> : undefined}
            subtitle={`${config.entity.label} · ${String(selected[idField])}`}
            actions={
              <>
                {visibleActions.map((a) => (
                  <Button
                    key={a.key}
                    variant={a.variant ?? "secondary"}
                    onClick={() => (a.confirm || (a.fields?.length ?? 0) > 0 ? setPendingAction(a) : void runAction(a, {}, ""))}
                  >
                    {a.label}
                  </Button>
                ))}
                <Button onClick={() => setSelectedId(null)}>Close</Button>
              </>
            }
            sections={config.detailView.sections.map((s) => ({
              title: s.title,
              fields: s.fields.map((name) => ({
                label: fields.get(name)?.label ?? name,
                value: renderField(fields.get(name), selected[name], selected),
                hint: fields.get(name)?.helpText ?? undefined,
              })),
            }))}
          >
            {notice ? <Alert tone={notice.tone}>{notice.text}</Alert> : null}
            {config.detailView.showApprovals !== false ? (
              <ApprovalWidget
                approvals={approvals}
                canDecide={(a) => hasPermission(session.principal, a.required_permission) && a.requested_by_email !== session.principal.email}
                onDecide={decide}
              />
            ) : null}
            {config.detailView.showAuditTrail !== false ? <AuditTrail entries={audit} /> : null}
          </DetailPane>
        </div>
      ) : null}
      {pendingAction && selected ? (
        <ActionModal action={pendingAction} fields={fields} entity={selected} onCancel={() => setPendingAction(null)} onSubmit={(payload, reason) => runAction(pendingAction, payload, reason)} />
      ) : null}
      {loading && items.length === 0 ? (
        <div className="fixed bottom-4 right-4">
          <Spinner label="Loading…" />
        </div>
      ) : null}
    </div>
  );
}

function ActionModal({
  action,
  fields,
  entity,
  onCancel,
  onSubmit,
}: {
  action: ActionSpec;
  fields: Map<string, EntityField>;
  entity: Entity;
  onCancel: () => void;
  onSubmit: (payload: Record<string, unknown>, reason: string) => Promise<void>;
}) {
  const editable = (action.fields ?? []).map((n) => fields.get(n)).filter((f): f is EntityField => Boolean(f));
  const [payload, setPayload] = useState<Record<string, unknown>>(() => Object.fromEntries(editable.map((f) => [f.name, entity[f.name] ?? (f.type === "boolean" ? false : "")])));
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const set = (name: string, value: unknown) => setPayload((p) => ({ ...p, [name]: value }));

  return (
    <Modal
      title={action.label}
      onClose={onCancel}
      footer={
        <>
          <Button onClick={onCancel}>Cancel</Button>
          <Button
            variant={action.variant ?? "primary"}
            loading={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await onSubmit(payload, reason);
              } finally {
                setBusy(false);
              }
            }}
          >
            {action.label}
          </Button>
        </>
      }
    >
      <div className="grid gap-3">
        {editable.map((f) => (
          <FormField key={f.name} label={f.label} hint={f.helpText ?? undefined}>
            {f.type === "boolean" ? (
              <Checkbox label={f.label} checked={Boolean(payload[f.name])} onChange={(e) => set(f.name, e.target.checked)} />
            ) : f.type === "enum" ? (
              <Select value={String(payload[f.name] ?? "")} options={f.enumValues ?? []} placeholder="Select…" onChange={(e) => set(f.name, e.target.value)} />
            ) : f.type === "text" ? (
              <TextArea value={String(payload[f.name] ?? "")} onChange={(e) => set(f.name, e.target.value)} />
            ) : f.type === "number" || f.type === "currency" ? (
              <TextInput type="number" value={String(payload[f.name] ?? "")} onChange={(e) => set(f.name, e.target.value === "" ? null : Number(e.target.value))} />
            ) : (
              <TextInput value={String(payload[f.name] ?? "")} onChange={(e) => set(f.name, e.target.value)} />
            )}
          </FormField>
        ))}
        {action.confirm || action.approval?.kind !== "never" ? (
          <FormField label="Reason (recorded in the audit trail)">
            <TextInput value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Optional" />
          </FormField>
        ) : null}
        {action.confirm ? (
          <Alert tone="info">
            Confirm <b>{action.label}</b> on <b>{String(entity[Object.keys(entity)[0]])}</b>? This is recorded in the audit trail.
          </Alert>
        ) : null}
      </div>
    </Modal>
  );
}
