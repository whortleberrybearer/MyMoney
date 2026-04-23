import { useEffect, useState } from "react";
import { RefreshCw, Trash2 } from "lucide-react";
import {
  listApiConnections,
  discoverStarlingAccounts,
  createSyncedAccounts,
  removeSyncedAccount,
  updateApiConnectionPat,
  syncStarlingConnection,
  createApiConnection,
  type ApiConnectionRow,
  type ApiAccount,
} from "@/lib/api-sync";
import { listInstitutions, type Institution } from "@/lib/institutions";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ConnectInstitutionDialog } from "./ConnectInstitutionDialog";
import { DiscoverAccountsDialog } from "./DiscoverAccountsDialog";
import { UpdatePatDialog } from "./UpdatePatDialog";

interface Props {
  onConnectionsChanged?: () => void;
}

function formatLastSynced(iso: string | null): string {
  if (!iso) return "Never synced";
  const d = new Date(iso);
  return d.toLocaleString();
}

export function ApiConnectionsSection({ onConnectionsChanged }: Props) {
  const [connections, setConnections] = useState<ApiConnectionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState<Set<number>>(new Set());
  const [syncError, setSyncError] = useState<string>("");

  // Dialog states
  const [connectOpen, setConnectOpen] = useState(false);
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [discoverOpen, setDiscoverOpen] = useState(false);
  const [discoverConnId, setDiscoverConnId] = useState<number | null>(null);
  const [discoveredAccounts, setDiscoveredAccounts] = useState<ApiAccount[]>([]);
  const [updatePatOpen, setUpdatePatOpen] = useState(false);
  const [updatePatConnId, setUpdatePatConnId] = useState<number | null>(null);
  const [removeAccountId, setRemoveAccountId] = useState<number | null>(null);
  const [removeConfirmOpen, setRemoveConfirmOpen] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const [conns, insts] = await Promise.all([listApiConnections(), listInstitutions()]);
      setConnections(conns);
      setInstitutions(insts);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function handleConnect(institutionId: number, pat: string) {
    await createApiConnection(institutionId, "starling", pat);
    await load();
    onConnectionsChanged?.();
  }

  async function handleDiscover(connectionId: number) {
    const accounts = await discoverStarlingAccounts(connectionId);
    setDiscoveredAccounts(accounts);
    setDiscoverConnId(connectionId);
    setDiscoverOpen(true);
  }

  async function handleImportAccounts(selected: ApiAccount[]) {
    if (discoverConnId == null) return;
    await createSyncedAccounts(discoverConnId, selected);
    await load();
    onConnectionsChanged?.();
    setDiscoverOpen(false);
  }

  async function handleResync(connectionId: number) {
    setSyncing((prev) => new Set(prev).add(connectionId));
    setSyncError("");
    try {
      await syncStarlingConnection(connectionId);
      await load();
    } catch (err) {
      setSyncError(String(err));
    } finally {
      setSyncing((prev) => {
        const next = new Set(prev);
        next.delete(connectionId);
        return next;
      });
    }
  }

  async function handleUpdatePat(connectionId: number, newPat: string) {
    await updateApiConnectionPat(connectionId, newPat);
    setUpdatePatOpen(false);
    await load();
  }

  function promptRemove(accountId: number) {
    setRemoveAccountId(accountId);
    setRemoveConfirmOpen(true);
  }

  async function confirmRemove() {
    if (removeAccountId == null) return;
    await removeSyncedAccount(removeAccountId);
    setRemoveConfirmOpen(false);
    setRemoveAccountId(null);
    await load();
    onConnectionsChanged?.();
  }

  // Accounts are stored per-institution. We query them from connections.
  // For simplicity, we show the institution name and connection controls;
  // individual account listing is handled by the parent (AccountsScreen).

  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
        API Connections
      </h2>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : connections.length === 0 ? (
        <div className="rounded-md border border-dashed p-6 flex flex-col items-center gap-3 text-center">
          <p className="text-sm text-muted-foreground">
            No institutions connected. Connect a bank to sync accounts and transactions automatically.
          </p>
          <Button variant="outline" size="sm" onClick={() => setConnectOpen(true)}>
            + Connect an institution
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {connections.map((conn) => (
            <div key={conn.id} className="rounded-md border p-4 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-sm">{conn.institutionName}</p>
                  <p className="text-xs text-muted-foreground">
                    Last synced: {formatLastSynced(conn.lastSyncedAt)}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => { setUpdatePatConnId(conn.id); setUpdatePatOpen(true); }}
                  >
                    Update PAT
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={syncing.has(conn.id)}
                    onClick={() => handleResync(conn.id)}
                    data-testid={`resync-btn-${conn.id}`}
                  >
                    <RefreshCw className={`h-4 w-4 mr-1 ${syncing.has(conn.id) ? "animate-spin" : ""}`} />
                    {syncing.has(conn.id) ? "Syncing…" : "Re-sync"}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDiscover(conn.id)}
                  >
                    Add account
                  </Button>
                </div>
              </div>
              {syncError && (
                <p className="text-xs text-destructive">{syncError}</p>
              )}
            </div>
          ))}

          <Button
            variant="outline"
            size="sm"
            className="w-fit"
            onClick={() => setConnectOpen(true)}
          >
            + Connect an institution
          </Button>
        </div>
      )}

      <ConnectInstitutionDialog
        open={connectOpen}
        onOpenChange={setConnectOpen}
        institutions={institutions}
        onConnect={handleConnect}
      />

      {discoverConnId != null && (
        <DiscoverAccountsDialog
          open={discoverOpen}
          onOpenChange={setDiscoverOpen}
          accounts={discoveredAccounts}
          onImport={handleImportAccounts}
        />
      )}

      {updatePatConnId != null && (
        <UpdatePatDialog
          open={updatePatOpen}
          onOpenChange={setUpdatePatOpen}
          onUpdate={(newPat) => handleUpdatePat(updatePatConnId, newPat)}
        />
      )}

      <AlertDialog open={removeConfirmOpen} onOpenChange={setRemoveConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove synced account?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the account and all its transactions. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button variant="outline" onClick={() => setRemoveConfirmOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmRemove}>
              Remove permanently
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
