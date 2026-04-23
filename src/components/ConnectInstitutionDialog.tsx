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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Institution } from "@/lib/institutions";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  institutions: Institution[];
  onConnect: (institutionId: number, pat: string) => Promise<void>;
}

export function ConnectInstitutionDialog({ open, onOpenChange, institutions, onConnect }: Props) {
  const [institutionId, setInstitutionId] = useState<string>("");
  const [pat, setPat] = useState("");
  const [patError, setPatError] = useState("");
  const [instError, setInstError] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState("");

  function reset() {
    setInstitutionId("");
    setPat("");
    setPatError("");
    setInstError("");
    setError("");
  }

  async function handleConnect() {
    setPatError("");
    setInstError("");
    setError("");

    let valid = true;
    if (!institutionId) {
      setInstError("Please select an institution.");
      valid = false;
    }
    if (!pat.trim()) {
      setPatError("Personal Access Token is required.");
      valid = false;
    }
    if (!valid) return;

    setConnecting(true);
    try {
      await onConnect(Number(institutionId), pat.trim());
      reset();
      onOpenChange(false);
    } catch (err) {
      setError(String(err));
    } finally {
      setConnecting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Connect an institution</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="institution-select">Institution</Label>
            <Select value={institutionId} onValueChange={setInstitutionId}>
              <SelectTrigger id="institution-select" data-testid="institution-select">
                <SelectValue placeholder="Select institution…" />
              </SelectTrigger>
              <SelectContent>
                {institutions.map((inst) => (
                  <SelectItem key={inst.id} value={String(inst.id)}>
                    {inst.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {instError && <p className="text-xs text-destructive">{instError}</p>}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="pat-input">Personal Access Token</Label>
            <Input
              id="pat-input"
              type="password"
              placeholder="Enter your PAT…"
              value={pat}
              onChange={(e) => setPat(e.target.value)}
              data-testid="pat-input"
            />
            <p className="text-xs text-muted-foreground">
              Your PAT is stored securely in your OS keychain and never written to the database.
            </p>
            {patError && <p className="text-xs text-destructive">{patError}</p>}
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => { reset(); onOpenChange(false); }}>
            Cancel
          </Button>
          <Button onClick={handleConnect} disabled={connecting} data-testid="connect-btn">
            {connecting ? "Connecting…" : "Connect"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
