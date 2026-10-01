import { useEffect, useState } from "react";
import { useIsSuperAdmin } from "../../auth/useIsSuperAdmin";
import { extractErrorMessage } from "../../api/client";
import { createAccountConfig, listAccountConfigs } from "../../api/gqApi";
import { AccountConfigResponse } from "../../api/types";
import { DataTable, DataTableColumn } from "../../components/DataTable";
import { PageHeader } from "../../components/PageHeader";
import { Pill } from "../../components/Pill";
import { useModal } from "../../components/modal/ModalContext";
import { useToast } from "../../components/toast/ToastContext";

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Admin UI for POST/GET /api/gq/account-config - the only thing this page can actually
 * do anything real about (see backend/webhooks.md). Channex's own API key, base URL and
 * rate limits are server-side deployment config, not per-property settings a UI form
 * would manage, and rate limits aren't tracked anywhere in GQ at all - registering the
 * Channex -> GQ webhook is the one real, working piece.
 */
export function Connection() {
  const isSuperAdmin = useIsSuperAdmin();
  const [rows, setRows] = useState<AccountConfigResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { showModal, closeModal } = useModal();
  const toast = useToast();

  async function load() {
    setLoading(true);
    setError(null);
    try {
      setRows(await listAccountConfigs());
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (isSuperAdmin) void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSuperAdmin]);

  function showSecret(secret: string) {
    showModal({
      title: "Webhook secret — copy it now",
      wide: true,
      body: (
        <>
          <p className="muted small" style={{ marginTop: 0 }}>
            Shown once, right now — GQ never returns it again after this. Paste it into
            Channex's webhook <code>headers</code> field as{" "}
            <code>x-channex-webhook-secret</code> when registering{" "}
            <code>POST {"{CHANNEX_BASE_URL}"}/webhooks</code>.
          </p>
          <div
            className="mono small"
            style={{
              wordBreak: "break-all",
              padding: "10px 12px",
              background: "var(--bg)",
              border: "1px solid var(--border)",
              borderRadius: 8,
            }}
          >
            {secret}
          </div>
        </>
      ),
      foot: (
        <>
          <button
            type="button"
            className="button button--ghost"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(secret);
                toast("Secret copied to clipboard.");
              } catch {
                toast("Couldn't copy automatically — select and copy it manually.", "warn");
              }
            }}
          >
            Copy
          </button>
          <button type="button" className="button button--primary" onClick={closeModal}>
            Done
          </button>
        </>
      ),
    });
  }

  function openCreate() {
    let webhookUrl = "";
    let apiKey = "";
    let environment = "production";
    let bqPropertyId = "";
    let sendData = false;
    let creating = false;
    let formError: string | null = null;

    function rerender() {
      showModal({
        title: "Register a Channex webhook",
        wide: true,
        body: (
          <>
            <p className="muted small" style={{ marginTop: 0 }}>
              Creates the config <code>POST /webhooks/channex</code> checks incoming
              Channex calls against. A random secret is generated automatically and
              shown once, right after creation.
            </p>
            {formError && <p className="form-error">{formError}</p>}
            <label className="field">
              <span className="field__label">Webhook URL (your public GQ endpoint)</span>
              <input
                type="text"
                className="field__input"
                placeholder="https://your-public-host.com/api/gq/webhooks/channex"
                value={webhookUrl}
                onChange={(e) => {
                  webhookUrl = e.target.value;
                  rerender();
                }}
              />
            </label>
            <label className="field">
              <span className="field__label">Channex API key</span>
              <input
                type="text"
                className="field__input"
                value={apiKey}
                onChange={(e) => {
                  apiKey = e.target.value;
                  rerender();
                }}
              />
            </label>
            <label className="field">
              <span className="field__label">Environment</span>
              <select
                className="field__input"
                value={environment}
                onChange={(e) => {
                  environment = e.target.value;
                  rerender();
                }}
              >
                <option value="production">production</option>
                <option value="staging">staging</option>
              </select>
            </label>
            <label className="field">
              <span className="field__label">Property id (optional — leave blank to apply to all properties)</span>
              <input
                type="number"
                className="field__input"
                min={1}
                value={bqPropertyId}
                onChange={(e) => {
                  bqPropertyId = e.target.value;
                  rerender();
                }}
              />
            </label>
            <label className="field" style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <input
                type="checkbox"
                checked={sendData}
                onChange={(e) => {
                  sendData = e.target.checked;
                  rerender();
                }}
              />
              <span className="field__label" style={{ margin: 0 }}>
                Send full booking data in the webhook payload
              </span>
            </label>
          </>
        ),
        foot: (
          <>
            <button type="button" className="button button--ghost" onClick={closeModal}>
              Cancel
            </button>
            <button
              type="button"
              className="button button--primary"
              disabled={creating}
              onClick={async () => {
                if (!webhookUrl.trim() || !apiKey.trim() || !environment.trim()) {
                  formError = "Webhook URL, API key and environment are required.";
                  rerender();
                  return;
                }
                creating = true;
                formError = null;
                rerender();
                try {
                  const result = await createAccountConfig({
                    webhookUrl: webhookUrl.trim(),
                    apiKey: apiKey.trim(),
                    environment: environment.trim(),
                    bqPropertyId: bqPropertyId.trim() ? Number(bqPropertyId.trim()) : undefined,
                    sendData,
                  });
                  closeModal();
                  showSecret(result.webhookSecret);
                  await load();
                } catch (err) {
                  creating = false;
                  formError = extractErrorMessage(err);
                  rerender();
                }
              }}
            >
              {creating ? "Creating…" : "Create"}
            </button>
          </>
        ),
      });
    }

    rerender();
  }

  const columns: DataTableColumn<AccountConfigResponse>[] = [
    { key: "url", label: "Webhook URL", render: (r) => <span className="mono small">{r.webhookUrl}</span> },
    { key: "env", label: "Environment", render: (r) => <code>{r.environment}</code> },
    { key: "property", label: "Property", render: (r) => (r.bqPropertyId !== null ? r.bqPropertyId : <span className="muted">All</span>) },
    {
      key: "active",
      label: "Status",
      render: (r) => (r.isActive ? <Pill label="Active" tone="success" /> : <Pill label="Inactive" tone="neutral" />),
    },
    { key: "sendData", label: "Send data", render: (r) => (r.sendData ? "Yes" : "No") },
    { key: "created", label: "Created", render: (r) => formatDateTime(r.createdAt) },
  ];

  if (!isSuperAdmin) {
    return (
      <div>
        <PageHeader title="Channex Connection" description="Webhook registration (Channex → GQ)" />
        <div className="card">
          <p className="muted">This page requires the Super_Admin role — your account doesn't have it.</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Channex Connection"
        description="Webhook registration — the secret POST /webhooks/channex checks every incoming Channex call against"
        actions={
          <button type="button" className="button button--primary" onClick={openCreate}>
            Register webhook config
          </button>
        }
      />
      {error && (
        <div className="card" style={{ marginBottom: 20 }}>
          <p className="form-error" role="alert">{error}</p>
        </div>
      )}
      <div className="card">
        <DataTable
          columns={columns}
          rows={rows}
          getRowKey={(r) => r.id}
          emptyMessage={loading ? "Loading…" : "No webhook configs yet — every webhook call is rejected until one exists."}
        />
      </div>
    </div>
  );
}
