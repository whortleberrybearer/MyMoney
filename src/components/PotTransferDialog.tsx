import { useState } from "react";
import { createPotTransfer, TransferDirection } from "@/lib/transfers";
import type { PotRow } from "@/lib/pots";
import type { AccountRow } from "@/lib/accounts";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pot: PotRow;
  account: AccountRow;
  onTransferred: () => void;
}

type FormState = {
  amount: string;
  date: string;
  notes: string;
  direction: TransferDirection;
};

type FormErrors = Partial<Record<"amount" | "date", string>>;

const EMPTY_FORM: FormState = {
  amount: "",
  date: "",
  notes: "",
  direction: "into_pot",
};

export function PotTransferDialog({
  open,
  onOpenChange,
  pot,
  account,
  onTransferred,
}: Props) {
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<FormErrors>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  function set<K extends keyof FormState>(field: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (field === "amount" || field === "date") {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  }

  function validate(): boolean {
    const errs: FormErrors = {};
    const amountNum = Number(form.amount);
    if (!form.amount || isNaN(amountNum) || amountNum <= 0) {
      errs.amount = "Amount must be greater than zero";
    }
    if (!form.date) {
      errs.date = "Date is required";
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleTransfer() {
    if (!validate()) return;
    setSaving(true);
    setSaveError("");
    try {
      await createPotTransfer({
        potId: pot.id,
        accountId: account.id,
        amount: Number(form.amount),
        date: form.date,
        direction: form.direction,
        notes: form.notes || undefined,
      });
      setForm(EMPTY_FORM);
      onTransferred();
      onOpenChange(false);
    } catch (err) {
      setSaveError(String(err).replace("Error: ", ""));
    } finally {
      setSaving(false);
    }
  }

  function handleOpenChange(open: boolean) {
    if (!open) {
      setForm(EMPTY_FORM);
      setErrors({});
      setSaveError("");
    }
    onOpenChange(open);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Transfer Funds</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          {saveError && (
            <p className="text-sm text-destructive">{saveError}</p>
          )}

          <div className="flex flex-col gap-0.5 text-sm">
            <span className="text-muted-foreground">Pot</span>
            <span className="font-medium">{pot.name}</span>
          </div>
          <div className="flex flex-col gap-0.5 text-sm">
            <span className="text-muted-foreground">Account</span>
            <span className="font-medium">{account.name}</span>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Direction</Label>
            <div className="flex gap-4">
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="direction"
                  value="into_pot"
                  checked={form.direction === "into_pot"}
                  onChange={() => set("direction", "into_pot")}
                />
                Into pot
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="direction"
                  value="out_of_pot"
                  checked={form.direction === "out_of_pot"}
                  onChange={() => set("direction", "out_of_pot")}
                />
                Out of pot
              </label>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="transfer-amount">Amount *</Label>
            <Input
              id="transfer-amount"
              type="number"
              step="0.01"
              min="0.01"
              value={form.amount}
              onChange={(e) => set("amount", e.target.value)}
              aria-invalid={!!errors.amount}
            />
            {errors.amount && (
              <p className="text-xs text-destructive">{errors.amount}</p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="transfer-date">Date *</Label>
            <Input
              id="transfer-date"
              type="date"
              value={form.date}
              onChange={(e) => set("date", e.target.value)}
              aria-invalid={!!errors.date}
            />
            {errors.date && (
              <p className="text-xs text-destructive">{errors.date}</p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="transfer-notes">Notes</Label>
            <Textarea
              id="transfer-notes"
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
              rows={2}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => handleOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleTransfer} disabled={saving}>
              {saving ? "Transferring…" : "Transfer"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
