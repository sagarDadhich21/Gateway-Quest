import { FormEvent, useState } from "react";
import { MockDataNotice } from "../../components/MockDataNotice";
import { PageHeader } from "../../components/PageHeader";
import { useModal } from "../../components/modal/ModalContext";
import { useToast } from "../../components/toast/ToastContext";
import { CX } from "../../mockData/core";
import { fmt } from "../../lib/format";

const WEBHOOK_EVENT_OPTIONS = [
  "booking_new", "booking_modification", "booking_cancellation", "booking_unmapped_room",
  "booking_unmapped_rate", "non_acked_booking", "ari", "sync_error", "sync_warning", "rate_error",
];

function RotateKeyForm({ onSave }: { onSave: (env: string) => void }) {
  const [key, setKey] = useState("");
  const [env, setEnv] = useState("Staging (staging.channex.io)");
  const [err, setErr] = useState("");

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (key.trim().length < 16) {
      setErr("A Channex API key is longer than that — check you pasted the whole thing.");
      return;
    }
    setErr("");
    onSave(env);
  }

  return (
    <form id="rotate-key-form" onSubmit={handleSubmit}>
      <p className="muted small" style={{ marginTop: 0, lineHeight: 1.7 }}>
        Create the key in your Channex user profile, then paste it here. Gateway Quest sends it in the{" "}
        <span className="mono">{CX.authHeader}</span> header on every request.
      </p>
      <label>New API key</label>
      <input value={key} onChange={(e) => setKey(e.target.value)} placeholder="ck_stg_…" />
      {err && <div className="form-error" style={{ marginBottom: 0 }}>{err}</div>}
      <label>Environment</label>
      <select value={env} onChange={(e) => setEnv(e.target.value)}>
        <option>Staging (staging.channex.io)</option>
        <option>Production (secure.channex.io)</option>
      </select>
    </form>
  );
}

function WebhookForm({
  webhookUrl,
  events,
  onSave,
}: {
  webhookUrl: string;
  events: string[];
  onSave: (url: string, events: string[]) => void;
}) {
  const [url, setUrl] = useState(webhookUrl);
  const [selected, setSelected] = useState(new Set(events));
  const [err, setErr] = useState("");

  function toggle(ev: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(ev)) next.delete(ev); else next.add(ev);
      return next;
    });
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!url.trim().startsWith("https://")) { setErr("Channex only accepts HTTPS webhook URLs."); return; }
    if (selected.size === 0) { setErr("Select at least one event."); return; }
    setErr("");
    onSave(url.trim(), Array.from(selected));
  }

  return (
    <form id="webhook-form" onSubmit={handleSubmit}>
      <label>Callback URL (HTTPS required)</label>
      <input value={url} onChange={(e) => setUrl(e.target.value)} />
      {err && <div className="form-error" style={{ marginBottom: 0 }}>{err}</div>}
      <div className="section-title">Events</div>
      {WEBHOOK_EVENT_OPTIONS.map((ev) => (
        <label key={ev} className="small" style={{ display: "block", margin: "6px 0", fontWeight: 400, textTransform: "none" }}>
          <input type="checkbox" checked={selected.has(ev)} onChange={() => toggle(ev)} style={{ width: "auto", marginRight: 6 }} />
          <span className="mono">{ev}</span>
        </label>
      ))}
      <div className="mock-notice" style={{ marginTop: 14, marginBottom: 0 }}>
        Your endpoint must return 200 even when EQ fails internally, otherwise Channex retries with backoff for around 24 hours.
      </div>
    </form>
  );
}

export function Connection() {
  const [status, setStatus] = useState(CX.status);
  const [apiKeyMasked, setApiKeyMasked] = useState(CX.apiKeyMasked);
  const [baseUrl, setBaseUrl] = useState(CX.baseUrl);
  const [webhookUrl, setWebhookUrl] = useState(CX.webhookUrl);
  const [webhookEvents, setWebhookEvents] = useState(CX.webhookEvents);
  const { showModal, closeModal } = useModal();
  const toast = useToast();

  function testConnection() {
    setStatus("Connected");
    toast(`Connected · ${CX.latency}ms`);
  }

  function openRotateKey() {
    showModal({
      title: "Rotate Channex API key",
      body: (
        <RotateKeyForm
          onSave={(env) => {
            setBaseUrl(env.startsWith("Production") ? "https://secure.channex.io/api/v1" : "https://staging.channex.io/api/v1");
            setApiKeyMasked("ck_stg_••••••••••4f21");
            setStatus("Connected");
            closeModal();
            toast("API key saved");
          }}
        />
      ),
      foot: (
        <>
          <button type="button" className="button button--ghost" onClick={closeModal}>Cancel</button>
          <button type="submit" form="rotate-key-form" className="button button--primary">Save and test</button>
        </>
      ),
    });
  }

  function openWebhookModal() {
    showModal({
      title: "Channex webhook",
      body: (
        <WebhookForm
          webhookUrl={webhookUrl}
          events={webhookEvents}
          onSave={(url, events) => {
            setWebhookUrl(url);
            setWebhookEvents(events);
            closeModal();
            toast("Webhook registered");
          }}
        />
      ),
      foot: (
        <>
          <button type="button" className="button button--ghost" onClick={closeModal}>Cancel</button>
          <button type="submit" form="webhook-form" className="button button--primary">Save webhook</button>
        </>
      ),
    });
  }

  return (
    <div>
      <PageHeader
        title="Channex Connection"
        description="API key, base URL, rate limits and webhook registration"
        actions={
          <>
            <button type="button" className="button button--ghost" onClick={testConnection}>Test connection</button>
            <button type="button" className="button button--primary" onClick={openRotateKey}>Rotate key</button>
          </>
        }
      />
      <MockDataNotice />
      <div className="card" style={{ marginBottom: 16 }}>
        <dl className="property-detail-list">
          <div className="property-detail-list__row"><dt>Status</dt><dd>{status} · {CX.latency}ms</dd></div>
          <div className="property-detail-list__row"><dt>Base URL</dt><dd><code>{baseUrl}</code></dd></div>
          <div className="property-detail-list__row"><dt>Auth header</dt><dd><code>{CX.authHeader}</code></dd></div>
          <div className="property-detail-list__row"><dt>API key</dt><dd>{apiKeyMasked}</dd></div>
          <div className="property-detail-list__row"><dt>Rate limit</dt><dd>{fmt(CX.rateLimit.used)} of {fmt(CX.rateLimit.limit)} — {CX.rateLimit.window}</dd></div>
          <div className="property-detail-list__row"><dt>Max message size</dt><dd>{CX.maxMessageMb} MB</dd></div>
        </dl>
      </div>

      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
          <h2 className="section-title" style={{ margin: 0 }}>Webhook registration</h2>
          <button type="button" className="button button--ghost" onClick={openWebhookModal}>Edit webhook</button>
        </div>
        <dl className="property-detail-list" style={{ marginBottom: 16 }}>
          <div className="property-detail-list__row"><dt>Callback URL</dt><dd><code>{webhookUrl}</code></dd></div>
          <div className="property-detail-list__row"><dt>Secret configured</dt><dd>{CX.webhookSecretSet ? "Yes" : "No"}</dd></div>
        </dl>
        <div className="muted" style={{ fontSize: 12, marginBottom: 8 }}>Subscribed events</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {webhookEvents.map((event) => (
            <span key={event} className="pill pill--neutral" style={{ fontFamily: "ui-monospace, monospace" }}>{event}</span>
          ))}
        </div>
      </div>
    </div>
  );
}
