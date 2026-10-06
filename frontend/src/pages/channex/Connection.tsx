import { useEffect, useState } from "react";
import { useIsSuperAdmin } from "../../auth/useIsSuperAdmin";
import { extractErrorMessage } from "../../api/client";
import {
  createAccountConfig,
  listAccountConfigs,
  registerAccountConfigWithChannex,
  rotateAccountConfigSecret,
  setAccountConfigActive,
} from "../../api/gqApi";
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
 * Channex -> GQ webhook is the one real, working piece. webhookUrl/environment are also
 * server-derived now (env.PUBLIC_WEBHOOK_BASE_URL / env.CHANNEX_ENVIRONMENT) rather than
 * typed here - a free-text URL field was the actual cause of the duplicate/stale configs
 * this page used to accumulate, since Channex allows only one webhook per URL.
 */
export function Connection() {
  const isSuperAdmin = useIsSuperAdmin();
  const [rows, setRows] = useState<AccountConfigResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [registeringId, setRegisteringId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [rotatingId, setRotatingId] = useState<string | null>(null);
  const { showModal, closeModal } = useModal();
  const toast = useToast();

  function registeredToastMessage(sharedWithOtherActiveConfigs: number): [string, "ok" | "warn"] {
    if (sharedWithOtherActiveConfigs === 0) {
      return ["Registered with Channex.", "ok"];
    }
    return [
      `Registered with Channex — but shared with ${sharedWithOtherActiveConfigs} other active config(s) for this URL. ` +
        "Channex only keeps one secret per webhook, so this is now the only one that's actually live — deactivate the others.",
      "warn",
    ];
  }

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

  async function registerWithChannex(id: string) {
    setRegisteringId(id);
    try {
      const result = await registerAccountConfigWithChannex(id);
      const [message, tone] = registeredToastMessage(result.sharedWithOtherActiveConfigs);
      toast(message, tone);
      await load();
    } catch (err) {
      toast(extractErrorMessage(err), "warn");
    } finally {
      setRegisteringId(null);
    }
  }

  async function toggleActive(id: string, isActive: boolean) {
    setTogglingId(id);
    try {
      await setAccountConfigActive(id, isActive);
      toast(isActive ? "Config activated." : "Config deactivated — its secret is no longer checked against inbound webhooks.");
      await load();
    } catch (err) {
      toast(extractErrorMessage(err), "warn");
    } finally {
      setTogglingId(null);
    }
  }

  function showSecret(id: string, secret: string) {
    let registering = false;
    let registerError: string | null = null;
    let registered = false;
    let sharedWithOtherActiveConfigs = 0;

    function rerender() {
      showModal({
        title: "Webhook secret — copy it now",
        wide: true,
        body: (
          <>
            <p className="muted small" style={{ marginTop: 0 }}>
              Shown once, right now — GQ never returns it again after this. Click{" "}
              <strong>Register with Channex</strong> below to have GQ call{" "}
              <code>POST {"{CHANNEX_BASE_URL}"}/webhooks</code> for you, or copy it and
              paste it into Channex's webhook <code>headers</code> field as{" "}
              <code>x-channex-webhook-secret</code> yourself.
            </p>
            {registerError && <p className="form-error">{registerError}</p>}
            {registered && sharedWithOtherActiveConfigs === 0 && (
              <p className="small" style={{ color: "var(--success, green)" }}>
                Registered with Channex.
              </p>
            )}
            {registered && sharedWithOtherActiveConfigs > 0 && (
              <p className="form-error">
                Registered — but shared with {sharedWithOtherActiveConfigs} other active config(s) for this
                URL. Channex only keeps one secret per webhook, so this is now the only one that's actually
                live. Deactivate the others from the table below.
              </p>
            )}
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
            <button
              type="button"
              className="button button--ghost"
              disabled={registering}
              onClick={async () => {
                registering = true;
                registerError = null;
                rerender();
                try {
                  const result = await registerAccountConfigWithChannex(id);
                  registered = true;
                  sharedWithOtherActiveConfigs = result.sharedWithOtherActiveConfigs;
                  await load();
                } catch (err) {
                  registerError = extractErrorMessage(err);
                } finally {
                  registering = false;
                  rerender();
                }
              }}
            >
              {registering ? "Registering…" : "Register with Channex"}
            </button>
            <button type="button" className="button button--primary" onClick={closeModal}>
              Done
            </button>
          </>
        ),
      });
    }

    rerender();
  }

  async function rotateSecret(id: string) {
    setRotatingId(id);
    try {
      const result = await rotateAccountConfigSecret(id);
      showSecret(result.id, result.webhookSecret);
    } catch (err) {
      toast(extractErrorMessage(err), "warn");
    } finally {
      setRotatingId(null);
    }
  }

  function openCreate() {
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
              Channex calls against. The webhook URL and a random secret are generated
              automatically - the secret is shown once, right after creation. Channex
              allows only one webhook per property (or one global one), so there can be
              at most one config per property here too - use <strong>Rotate secret</strong>{" "}
              on an existing row instead of creating another one for the same property.
            </p>
            {formError && <p className="form-error">{formError}</p>}
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
                creating = true;
                formError = null;
                rerender();
                try {
                  const result = await createAccountConfig({
                    bqPropertyId: bqPropertyId.trim() ? Number(bqPropertyId.trim()) : undefined,
                    sendData,
                  });
                  closeModal();
                  showSecret(result.id, result.webhookSecret);
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
    {
      key: "cxWebhookId",
      label: "Channex",
      render: (r) =>
        r.cxWebhookId ? (
          <Pill label="Registered" tone="success" />
        ) : (
          <Pill label="Not registered" tone="warning" />
        ),
    },
    { key: "created", label: "Created", render: (r) => formatDateTime(r.createdAt) },
    {
      key: "actions",
      label: "",
      render: (r) => (
        <div style={{ display: "flex", gap: 8 }}>
          <button
            type="button"
            className="button button--ghost"
            disabled={registeringId === r.id}
            onClick={() => registerWithChannex(r.id)}
          >
            {registeringId === r.id ? "Registering…" : r.cxWebhookId ? "Re-register" : "Register"}
          </button>
          <button
            type="button"
            className="button button--ghost"
            disabled={rotatingId === r.id}
            onClick={() => rotateSecret(r.id)}
          >
            {rotatingId === r.id ? "…" : "Rotate secret"}
          </button>
          <button
            type="button"
            className="button button--ghost"
            disabled={togglingId === r.id}
            onClick={() => toggleActive(r.id, !r.isActive)}
          >
            {togglingId === r.id ? "…" : r.isActive ? "Deactivate" : "Activate"}
          </button>
        </div>
      ),
    },
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
