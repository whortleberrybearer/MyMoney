import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate: (newPat: string) => Promise<void>;
}

export function UpdatePatDialog({ open, onOpenChange, onUpdate }: Props) {
  const [pat, setPat] = useState("");
  const [patError, setPatError] = useState("");
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState("");

  function reset() {
    setPat("");
    setPatError("");
    setError("");
  }

  async function handleUpdate() {
    setPatError("");
    setError("");

    if (!pat.trim()) {
      setPatError("Personal Access Token is required.");
      return;
    }

    setUpdating(true);
    try {
      await onUpdate(pat.trim());
      reset();
    } catch (err) {
      setError(String(err));
    } finally {
      setUpdating(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Update Personal Access Token</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="new-pat-input">New Personal Access Token</Label>
            <Input
              id="new-pat-input"
              type="password"
              placeholder="Enter your new PAT…"
              value={pat}
              onChange={(e) => setPat(e.target.value)}
              data-testid="new-pat-input"
            />
            {patError && <p className="text-xs text-destructive">{patError}</p>}
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => { reset(); onOpenChange(false); }}>
            Cancel
          </Button>
          <Button onClick={handleUpdate} disabled={updating} data-testid="update-pat-btn">
            {updating ? "Updating…" : "Update PAT"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
