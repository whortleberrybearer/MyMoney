import { useEffect, useState } from "react";
import { createPot, updatePot } from "@/lib/pots";
import type { PotRow } from "@/lib/pots";
import type { AccountRow } from "@/lib/accounts";
import { listTags, Tag } from "@/lib/reference-data";
import { TagCombobox } from "@/components/TagCombobox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  account: AccountRow;
  editPot?: PotRow;
  onSaved: () => void;
  onTagCreated?: (tag: Tag) => void;
}

type FormState = {
  name: string;
  openingBalance: string;
  openingDate: string;
  notes: string;
};

type FormErrors = Partial<Record<keyof FormState, string>>;

const EMPTY_FORM: FormState = {
  name: "",
  openingBalance: "0",
  openingDate: "",
  notes: "",
};

export function PotFormSheet({
  open,
  onOpenChange,
  account,
  editPot,
  onSaved,
  onTagCreated,
}: Props) {
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [selectedTagId, setSelectedTagId] = useState<number | null>(null);
  const [errors, setErrors] = useState<FormErrors>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [tags, setTags] = useState<Tag[]>([]);

  useEffect(() => {
    if (open) {
      listTags().then(setTags);
      if (editPot) {
        setForm({
          name: editPot.name,
          openingBalance: String(editPot.openingBalance),
          openingDate: editPot.openingDate,
          notes: editPot.notes ?? "",
        });
        setSelectedTagId(editPot.tagId ?? null);
      } else {
        setForm(EMPTY_FORM);
        setSelectedTagId(null);
      }
      setErrors({});
      setSaveError("");
    }
  }, [open, editPot]);

  function set(field: keyof FormState, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: undefined }));
  }

  function validate(): boolean {
    const errs: FormErrors = {};
    if (!form.name.trim()) errs.name = "Name is required";
    if (form.openingBalance !== "" && isNaN(Number(form.openingBalance))) {
      errs.openingBalance = "Opening balance must be a number";
    }
    if (!form.openingDate) errs.openingDate = "Opening date is required";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSave() {
    if (!validate()) return;
    setSaving(true);
    setSaveError("");
    try {
      const payload = {
        accountId: account.id,
        name: form.name.trim(),
        openingBalance:
          form.openingBalance === "" ? 0 : Number(form.openingBalance),
        openingDate: form.openingDate,
        notes: form.notes || undefined,
        tagId: selectedTagId ?? undefined,
      };
      if (editPot) {
        await updatePot({ ...payload, id: editPot.id });
      } else {
        await createPot(payload);
      }
      onSaved();
      onOpenChange(false);
    } catch (err) {
      setSaveError(String(err).replace("Error: ", ""));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex flex-col gap-0 overflow-y-auto sm:max-w-md">
        <SheetHeader className="px-6 pb-4 pt-6">
          <SheetTitle>{editPot ? "Edit Pot" : "New Pot"}</SheetTitle>
        </SheetHeader>

        <div className="flex flex-col gap-4 px-6 pb-6">
          {saveError && (
            <p className="text-sm text-destructive">{saveError}</p>
          )}

          <div className="flex flex-col gap-1.5">
            <Label className="text-muted-foreground text-xs">Account</Label>
            <p className="text-sm font-medium">{account.name}</p>
            <p className="text-muted-foreground text-xs">{account.currency}</p>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="pot-name">Name *</Label>
            <Input
              id="pot-name"
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              aria-invalid={!!errors.name}
            />
            {errors.name && (
              <p className="text-xs text-destructive">{errors.name}</p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="pot-opening-balance">Opening Balance</Label>
            <Input
              id="pot-opening-balance"
              type="number"
              step="0.01"
              value={form.openingBalance}
              onChange={(e) => set("openingBalance", e.target.value)}
              aria-invalid={!!errors.openingBalance}
            />
            {errors.openingBalance && (
              <p className="text-xs text-destructive">{errors.openingBalance}</p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="pot-opening-date">Opening Date *</Label>
            <Input
              id="pot-opening-date"
              type="date"
              value={form.openingDate}
              onChange={(e) => set("openingDate", e.target.value)}
              aria-invalid={!!errors.openingDate}
            />
            {errors.openingDate && (
              <p className="text-xs text-destructive">{errors.openingDate}</p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="pot-tag">Tag</Label>
            <TagCombobox
              id="pot-tag"
              tags={tags}
              value={selectedTagId}
              onChange={setSelectedTagId}
              onTagCreated={(newTag) => {
                setTags((prev) =>
                  [...prev, newTag].sort((a, b) => a.name.localeCompare(b.name)),
                );
                onTagCreated?.(newTag);
              }}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="pot-notes">Notes</Label>
            <Textarea
              id="pot-notes"
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
              rows={3}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
