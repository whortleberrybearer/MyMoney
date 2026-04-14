import { useEffect, useState } from "react";
import { createAccount, AccountRow, updateAccount } from "@/lib/accounts";
import { Institution, listInstitutions } from "@/lib/institutions";
import {
  AccountType,
  CURRENCIES,
  DEFAULT_CURRENCY,
  listAccountTypes,
  listTags,
  Tag,
} from "@/lib/reference-data";
import { TagCombobox } from "@/components/TagCombobox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { InstitutionManagementDialog } from "./InstitutionManagementDialog";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editAccount?: AccountRow;
  onSaved: () => void;
  onTagCreated?: (tag: Tag) => void;
}

type FormState = {
  name: string;
  institutionId: string;
  accountTypeId: string;
  currency: string;
  openingBalance: string;
  openingDate: string;
  notes: string;
};

type FormErrors = Partial<Record<keyof FormState, string>>;

const EMPTY_FORM: FormState = {
  name: "",
  institutionId: "",
  accountTypeId: "",
  currency: DEFAULT_CURRENCY,
  openingBalance: "0",
  openingDate: "",
  notes: "",
};

export function AccountFormSheet({ open, onOpenChange, editAccount, onSaved, onTagCreated }: Props) {
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [selectedTagId, setSelectedTagId] = useState<number | null>(null);
  const [errors, setErrors] = useState<FormErrors>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [accountTypes, setAccountTypes] = useState<AccountType[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [institutionDialogOpen, setInstitutionDialogOpen] = useState(false);

  useEffect(() => {
    if (open) {
      loadRefData();
      if (editAccount) {
        setForm({
          name: editAccount.name,
          institutionId: String(editAccount.institutionId),
          accountTypeId: String(editAccount.accountTypeId),
          currency: editAccount.currency,
          openingBalance: String(editAccount.openingBalance),
          openingDate: editAccount.openingDate,
          notes: editAccount.notes ?? "",
        });
        setSelectedTagId(editAccount.tagId ?? null);
      } else {
        setForm(EMPTY_FORM);
        setSelectedTagId(null);
      }
      setErrors({});
      setSaveError("");
    }
  }, [open, editAccount]);

  async function loadRefData() {
    const [insts, types, tagList] = await Promise.all([
      listInstitutions(),
      listAccountTypes(),
      listTags(),
    ]);
    setInstitutions(insts);
    setAccountTypes(types);
    setTags(tagList);
  }

  function set(field: keyof FormState, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: undefined }));
  }

  function validate(): boolean {
    const errs: FormErrors = {};
    if (!form.name.trim()) errs.name = "Name is required";
    if (!form.institutionId) errs.institutionId = "Institution is required";
    if (!form.accountTypeId) errs.accountTypeId = "Account type is required";
    if (!form.currency) errs.currency = "Currency is required";
    if (form.openingBalance === "" || isNaN(Number(form.openingBalance))) {
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
        name: form.name.trim(),
        institutionId: Number(form.institutionId),
        accountTypeId: Number(form.accountTypeId),
        currency: form.currency,
        openingBalance: Number(form.openingBalance),
        openingDate: form.openingDate,
        notes: form.notes || undefined,
        tagId: selectedTagId ?? undefined,
      };
      if (editAccount) {
        await updateAccount({ ...payload, id: editAccount.id });
      } else {
        await createAccount(payload);
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
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="flex flex-col gap-0 overflow-y-auto sm:max-w-md">
          <SheetHeader className="px-6 pb-4 pt-6">
            <SheetTitle>{editAccount ? "Edit Account" : "New Account"}</SheetTitle>
          </SheetHeader>

          <div className="flex flex-col gap-4 px-6 pb-6">
            {saveError && (
              <p className="text-sm text-destructive">{saveError}</p>
            )}

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="acc-name">Name *</Label>
              <Input
                id="acc-name"
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
                aria-invalid={!!errors.name}
              />
              {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
            </div>

            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="acc-institution">Institution *</Label>
                <button
                  type="button"
                  className="text-xs text-primary underline-offset-2 hover:underline"
                  onClick={() => setInstitutionDialogOpen(true)}
                >
                  Manage
                </button>
              </div>
              <Select
                value={form.institutionId || undefined}
                onValueChange={(v) => set("institutionId", v)}
              >
                <SelectTrigger id="acc-institution" aria-invalid={!!errors.institutionId}>
                  <SelectValue placeholder="Select institution" />
                </SelectTrigger>
                <SelectContent>
                  {institutions.map((inst) => (
                    <SelectItem key={inst.id} value={String(inst.id)}>
                      {inst.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.institutionId && (
                <p className="text-xs text-destructive">{errors.institutionId}</p>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="acc-type">Account Type *</Label>
              <Select
                value={form.accountTypeId || undefined}
                onValueChange={(v) => set("accountTypeId", v)}
              >
                <SelectTrigger id="acc-type" aria-invalid={!!errors.accountTypeId}>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  {accountTypes.map((at) => (
                    <SelectItem key={at.id} value={String(at.id)}>
                      {at.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.accountTypeId && (
                <p className="text-xs text-destructive">{errors.accountTypeId}</p>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="acc-currency">Currency *</Label>
              <Select
                value={form.currency}
                onValueChange={(v) => set("currency", v)}
              >
                <SelectTrigger id="acc-currency" aria-invalid={!!errors.currency}>
                  <SelectValue placeholder="Select currency" />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.currency && (
                <p className="text-xs text-destructive">{errors.currency}</p>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="acc-opening-balance">Opening Balance *</Label>
              <Input
                id="acc-opening-balance"
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
              <Label htmlFor="acc-opening-date">Opening Date *</Label>
              <Input
                id="acc-opening-date"
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
              <Label htmlFor="acc-tag">Tag</Label>
              <TagCombobox
                id="acc-tag"
                tags={tags}
                value={selectedTagId}
                onChange={setSelectedTagId}
                onTagCreated={(newTag) => {
                  setTags((prev) => [...prev, newTag].sort((a, b) => a.name.localeCompare(b.name)));
                  onTagCreated?.(newTag);
                }}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="acc-notes">Notes</Label>
              <Textarea
                id="acc-notes"
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

      <InstitutionManagementDialog
        open={institutionDialogOpen}
        onOpenChange={(o) => {
          setInstitutionDialogOpen(o);
          if (!o) {
            listInstitutions().then(setInstitutions);
          }
        }}
      />
    </>
  );
}
