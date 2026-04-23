import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { ApiAccount } from "@/lib/api-sync";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accounts: ApiAccount[];
  onImport: (selected: ApiAccount[]) => Promise<void>;
}

export function DiscoverAccountsDialog({ open, onOpenChange, accounts, onImport }: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setSelected(new Set(accounts.map((a) => a.external_id)));
      setError("");
    }
  }, [open, accounts]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleImport() {
    if (selected.size === 0) {
      setError("Please select at least one account.");
      return;
    }
    setImporting(true);
    setError("");
    try {
      const selectedAccounts = accounts.filter((a) => selected.has(a.external_id));
      await onImport(selectedAccounts);
    } catch (err) {
      setError(String(err));
    } finally {
      setImporting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Select accounts to import</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-2 py-2 max-h-72 overflow-y-auto">
          {accounts.length === 0 ? (
            <p className="text-sm text-muted-foreground">No accounts found.</p>
          ) : (
            accounts.map((acc) => (
              <label
                key={acc.external_id}
                className="flex items-center gap-3 cursor-pointer rounded-md border p-3 hover:bg-muted/50"
                data-testid={`account-option-${acc.external_id}`}
              >
                <input
                  type="checkbox"
                  checked={selected.has(acc.external_id)}
                  onChange={() => toggle(acc.external_id)}
                  className="h-4 w-4 accent-primary"
                />
                <div>
                  <p className="text-sm font-medium">{acc.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {acc.currency} · {acc.account_type_raw}
                  </p>
                </div>
              </label>
            ))
          )}
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <p className="text-xs text-muted-foreground">
          Selected accounts will be created and synced immediately.
        </p>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleImport} disabled={importing || accounts.length === 0} data-testid="import-accounts-btn">
            {importing ? "Importing…" : "Import"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
