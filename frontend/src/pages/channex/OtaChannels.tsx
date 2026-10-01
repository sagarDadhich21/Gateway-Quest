import { useEffect, useState } from "react";
import { getSession } from "../../auth/session";
import { useCurrentPropertyId } from "../../auth/useCurrentProperty";
import { extractErrorMessage } from "../../api/client";
import {
  activateChannel,
  deactivateChannel,
  deleteChannelMapping,
  generateConnectionToken,
  getRoomTypes,
  listChannelMappings,
  listChannels,
  listRatePlans,
} from "../../api/gqApi";
import { ChannelMappingResponse, ChannelResponse, RatePlan, RoomTypeSummary } from "../../api/types";
import { DataTable, DataTableColumn } from "../../components/DataTable";
import { PageHeader } from "../../components/PageHeader";
import { Pill } from "../../components/Pill";
import { useModal } from "../../components/modal/ModalContext";
import { useToast } from "../../components/toast/ToastContext";

export function OtaChannels() {
  const propertyId = useCurrentPropertyId();
  const [channels, setChannels] = useState<ChannelResponse[]>([]);
  const [roomTypes, setRoomTypes] = useState<RoomTypeSummary[]>([]);
  const [ratePlans, setRatePlans] = useState<RatePlan[]>([]);
  const [loading, setLoading] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { showModal, closeModal } = useModal();
  const toast = useToast();

  async function load() {
    if (propertyId === null) return;
    setLoading(true);
    setError(null);
    try {
      const [chs, types, plans] = await Promise.all([
        listChannels(propertyId),
        getRoomTypes(propertyId),
        listRatePlans(propertyId),
      ]);
      setChannels(chs);
      setRoomTypes(types);
      setRatePlans(plans);
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [propertyId]);

  function roomTypeName(id: number): string {
    return roomTypes.find((rt) => rt.id === id)?.name ?? `#${id}`;
  }
  function ratePlanName(id: string): string {
    return ratePlans.find((rp) => rp.id === id)?.name ?? id;
  }

  async function handleConnect() {
    if (propertyId === null) return;
    setConnecting(true);
    try {
      const result = await generateConnectionToken(propertyId, getSession()?.email);
      showModal({
        title: "Connect a channel",
        extraWide: true,
        body: (
          <>
            <p className="muted small" style={{ marginTop: 0 }}>
              This is Channex's own connection screen — pick a channel (e.g. Booking.com) and follow its steps. This
              link expires in {result.expiresInMinutes} minutes and can only be used once.
            </p>
            <iframe
              src={result.iframeUrl}
              title="Channex connection"
              style={{ width: "100%", height: 700, border: "1px solid var(--border)", borderRadius: 8 }}
            />
          </>
        ),
        foot: (
          <button
            type="button"
            className="button button--primary"
            onClick={() => {
              closeModal();
              toast("Refreshing channel list…");
              void load();
            }}
          >
            Done — refresh list
          </button>
        ),
      });
    } catch (err) {
      toast(extractErrorMessage(err), "err");
    } finally {
      setConnecting(false);
    }
  }

  async function handleToggleActive(channel: ChannelResponse) {
    try {
      if (channel.isActive) {
        await deactivateChannel(channel.id);
        toast(`${channel.title} deactivated`);
      } else {
        await activateChannel(channel.id);
        toast(`${channel.title} activated`);
      }
      await load();
    } catch (err) {
      toast(extractErrorMessage(err), "err");
    }
  }

  function openMappings(channel: ChannelResponse) {
    let mappings: ChannelMappingResponse[] = [];
    let loadingMappings = true;
    let mappingError: string | null = null;

    async function loadMappings() {
      loadingMappings = true;
      mappingError = null;
      rerender();
      try {
        mappings = await listChannelMappings(channel.id);
      } catch (err) {
        mappingError = extractErrorMessage(err);
      } finally {
        loadingMappings = false;
        rerender();
      }
    }

    async function handleDelete(mapping: ChannelMappingResponse) {
      try {
        await deleteChannelMapping(channel.id, mapping.id);
        toast("Mapping removed from GQ's local cache.");
        await loadMappings();
      } catch (err) {
        toast(extractErrorMessage(err), "err");
      }
    }

    function rerender() {
      showModal({
        title: `${channel.title} — room/rate mappings`,
        wide: true,
        body: (
          <>
            <p className="muted small" style={{ marginTop: 0 }}>
              Synced live from Channex — mappings themselves are configured in Channex's own connection screen, not
              here. Removing one below only clears GQ's local cache; it stays on Channex's side.
            </p>
            {mappingError && <p className="form-error">{mappingError}</p>}
            {loadingMappings ? (
              <p className="muted small">Loading…</p>
            ) : mappings.length === 0 ? (
              <p className="muted small">No mappings yet.</p>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Room type</th>
                    <th>Rate plan</th>
                    <th>OTA room code</th>
                    <th>OTA rate code</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {mappings.map((m) => (
                    <tr key={m.id}>
                      <td>{roomTypeName(m.roomTypeId)}</td>
                      <td>{ratePlanName(m.ratePlanId)}</td>
                      <td className="mono small">{m.otaRoomCode}</td>
                      <td className="mono small">{m.otaRateCode}</td>
                      <td style={{ textAlign: "right" }}>
                        <button type="button" className="button button--danger" onClick={() => handleDelete(m)}>
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </>
        ),
        foot: (
          <>
            <button type="button" className="button button--ghost" onClick={() => void loadMappings()}>
              Re-sync
            </button>
            <button type="button" className="button button--ghost" onClick={closeModal}>
              Close
            </button>
          </>
        ),
      });
    }

    rerender();
    void loadMappings();
  }

  const columns: DataTableColumn<ChannelResponse>[] = [
    { key: "title", label: "Channel", render: (c) => <><strong>{c.title}</strong><div className="muted small">{c.channel}</div></> },
    { key: "currency", label: "Currency", render: (c) => c.currency ?? "—" },
    { key: "status", label: "Status", render: (c) => (c.isActive ? <Pill label="Active" tone="success" /> : <Pill label="Inactive" tone="neutral" />) },
    {
      key: "actions",
      label: "",
      align: "right",
      render: (c) => (
        <div className="row-actions">
          <button type="button" className="button button--ghost" onClick={() => openMappings(c)}>
            Mappings
          </button>
          <button
            type="button"
            className={"button " + (c.isActive ? "button--danger" : "button--primary")}
            onClick={() => void handleToggleActive(c)}
          >
            {c.isActive ? "Deactivate" : "Activate"}
          </button>
        </div>
      ),
    },
  ];

  if (propertyId === null) {
    return (
      <div>
        <PageHeader title="OTA Channels" description="OTA connections that Channex distributes to" />
        <div className="card">
          <p className="muted">Your account has no assigned property, so there is nothing to load here.</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="OTA Channels"
        description="OTA connections that Channex distributes to"
        actions={
          <button type="button" className="button button--primary" onClick={handleConnect} disabled={connecting}>
            {connecting ? "Generating link…" : "Connect a channel"}
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
          rows={channels}
          getRowKey={(c) => c.id}
          emptyMessage={loading ? "Loading…" : "No channels connected yet."}
        />
      </div>
    </div>
  );
}
