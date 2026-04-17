import { useEffect, useState } from "react";
import {
  createTransaction,
  updateTransaction,
  type TransactionRow,
} from "@/lib/transactions";
import { listCategories, type Category } from "@/lib/categories";
import { CategoryCombobox } from "@/components/CategoryCombobox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accountId: number;
  /** When provided, the sheet is in edit mode for this transaction. */
  editTransaction?: TransactionRow;
  onSaved: () => void;
}

type FormState = {
  date: string;
  amount: string;
  payee: string;
  notes: string;
  reference: string;
  categoryId: number | null;
};

type FormErrors = Partial<Record<keyof FormState, string>>;

const EMPTY_FORM: FormState = {
  date: new Date().toISOString().split("T")[0],
  amount: "",
  payee: "",
  notes: "",
  reference: "",
  categoryId: null,
};

export function TransactionFormSheet({
  open,
  onOpenChange,
  accountId,
  editTransaction,
  onSaved,
}: Props) {
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<FormErrors>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [categories, setCategories] = useState<Category[]>([]);

  const isEditMode = editTransaction !== undefined;
  const isImported = editTransaction?.type === "imported";

  useEffect(() => {
    if (open) {
      loadCategories();
      if (editTransaction) {
        setForm({
          date: editTransaction.date,
          amount: String(editTransaction.amount),
          payee: editTransaction.payee ?? "",
          notes: editTransaction.notes ?? "",
          reference: editTransaction.reference ?? "",
          categoryId: editTransaction.categoryId ?? null,
        });
      } else {
        setForm(EMPTY_FORM);
      }
      setErrors({});
      setSaveError("");
    }
  }, [open, editTransaction]);

  async function loadCategories() {
    setCategories(await listCategories());
  }

  function setField<K extends keyof FormState>(field: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: undefined }));
  }

  function validate(): boolean {
    const newErrors: FormErrors = {};
    if (!form.date) newErrors.date = "Date is required";
    if (!form.amount || isNaN(Number(form.amount))) {
      newErrors.amount = "A valid amount is required";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleSave() {
    if (!validate()) return;
    setSaving(true);
    setSaveError("");
    try {
      if (isEditMode && editTransaction) {
        await updateTransaction({
          id: editTransaction.id,
          // Only send date/amount for manual transactions
          ...(isImported ? {} : {
            date: form.date,
            amount: Number(form.amount),
          }),
          payee: form.payee || null,
          notes: form.notes || null,
          reference: form.reference || null,
          categoryId: form.categoryId,
        });
      } else {
        await createTransaction(accountId, {
          date: form.date,
          amount: Number(form.amount),
          payee: form.payee || undefined,
          notes: form.notes || undefined,
          reference: form.reference || undefined,
          categoryId: form.categoryId ?? undefined,
        });
      }
      onOpenChange(false);
      onSaved();
    } catch (err) {
      setSaveError(String(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>
            {isEditMode ? "Edit Transaction" : "Add Transaction"}
          </SheetTitle>
        </SheetHeader>

        <div className="mt-6 flex flex-col gap-4 px-1">
          {/* Date */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="tx-date">Date *</Label>
            <Input
              id="tx-date"
              type="date"
              value={form.date}
              onChange={(e) => setField("date", e.target.value)}
              readOnly={isImported}
              aria-readonly={isImported}
              data-testid="tx-date"
            />
            {errors.date && (
              <p className="text-destructive text-xs">{errors.date}</p>
            )}
          </div>

          {/* Amount */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="tx-amount">Amount *</Label>
            <Input
              id="tx-amount"
              type="number"
              step="0.01"
              placeholder="e.g. -12.50 or 500"
              value={form.amount}
              onChange={(e) => setField("amount", e.target.value)}
              readOnly={isImported}
              aria-readonly={isImported}
              data-testid="tx-amount"
            />
            {errors.amount && (
              <p className="text-destructive text-xs">{errors.amount}</p>
            )}
          </div>

          {/* Payee */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="tx-payee">Payee</Label>
            <Input
              id="tx-payee"
              placeholder="e.g. Starbucks"
              value={form.payee}
              onChange={(e) => setField("payee", e.target.value)}
              data-testid="tx-payee"
            />
          </div>

          {/* Notes */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="tx-notes">Notes</Label>
            <Input
              id="tx-notes"
              placeholder="Bank description or your notes"
              value={form.notes}
              onChange={(e) => setField("notes", e.target.value)}
              data-testid="tx-notes"
            />
          </div>

          {/* Reference */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="tx-reference">Reference</Label>
            <Input
              id="tx-reference"
              placeholder="Payment reference"
              value={form.reference}
              onChange={(e) => setField("reference", e.target.value)}
              data-testid="tx-reference"
            />
          </div>

          {/* Category */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="tx-category">Category</Label>
            <CategoryCombobox
              id="tx-category"
              categories={categories}
              value={form.categoryId}
              onChange={(id) => setField("categoryId", id)}
            />
          </div>

          {saveError && (
            <p className="text-destructive text-sm">{saveError}</p>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving} data-testid="tx-save">
              {saving ? "Saving…" : "Save"}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
