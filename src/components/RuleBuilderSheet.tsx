import { useEffect, useState } from "react";
import { Plus, X } from "lucide-react";
import { listCategories, type Category } from "@/lib/categories";
import { createRule, updateRule, type Rule, type RuleAction, type RuleCondition } from "@/lib/rules";
import { CategoryCombobox } from "@/components/CategoryCombobox";
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

// ---------------------------------------------------------------------------
// Field / operator definitions
// ---------------------------------------------------------------------------

const TEXT_FIELDS = [
  { value: "description", label: "Description" },
  { value: "reference", label: "Reference" },
  { value: "transaction_type", label: "Transaction type" },
  { value: "payee", label: "Payee" },
  { value: "account", label: "Account" },
  { value: "category", label: "Category" },
] as const;

const NUMERIC_FIELDS = [{ value: "amount", label: "Amount" }] as const;

const ALL_FIELDS = [...TEXT_FIELDS, ...NUMERIC_FIELDS];

const TEXT_OPERATORS = [
  { value: "contains", label: "Contains" },
  { value: "starts_with", label: "Starts with" },
  { value: "equals", label: "Equals" },
] as const;

const NUMERIC_OPERATORS = [
  { value: "equals", label: "Equals" },
  { value: "greater_than", label: "Greater than" },
  { value: "less_than", label: "Less than" },
] as const;

const ACTION_TYPES = [
  { value: "assign_category", label: "Assign category" },
  { value: "set_note", label: "Set note" },
] as const;

function operatorsForField(field: string) {
  return field === "amount" ? NUMERIC_OPERATORS : TEXT_OPERATORS;
}

// ---------------------------------------------------------------------------
// Local form types
// ---------------------------------------------------------------------------

type ConditionForm = {
  key: number;
  field: string;
  operator: string;
  value: string;
};

type ActionForm = {
  key: number;
  actionType: "assign_category" | "set_note";
  categoryId: number | null;
  note: string;
};

let keyCounter = 0;
function nextKey() {
  return ++keyCounter;
}

function emptyCondition(): ConditionForm {
  return { key: nextKey(), field: "description", operator: "contains", value: "" };
}

function emptyAction(): ActionForm {
  return { key: nextKey(), actionType: "assign_category", categoryId: null, note: "" };
}

// ---------------------------------------------------------------------------
// Pre-filled input from category change shortcut
// ---------------------------------------------------------------------------

export type RuleBuilderPrefill = {
  name: string;
  condition: Omit<RuleCondition, "id">;
  action: Omit<RuleAction, "id">;
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** When provided, the builder is in edit mode. */
  editRule?: Rule;
  /** Pre-filled values for the create flow (category change shortcut). */
  prefill?: RuleBuilderPrefill;
  /** Called after the rule is successfully saved. */
  onSaved: (ruleId: number, triggeredRerun: boolean) => void;
  /** If true, saving will call applyRules() on all transactions. */
  triggerRerunOnSave?: boolean;
}

export function RuleBuilderSheet({
  open,
  onOpenChange,
  editRule,
  prefill,
  onSaved,
  triggerRerunOnSave = false,
}: Props) {
  const [name, setName] = useState("");
  const [conditions, setConditions] = useState<ConditionForm[]>([emptyCondition()]);
  const [actions, setActions] = useState<ActionForm[]>([emptyAction()]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  const isEditMode = editRule !== undefined;

  useEffect(() => {
    if (!open) return;
    loadCategories();
    if (editRule) {
      setName(editRule.name);
      setConditions(
        editRule.conditions.length > 0
          ? editRule.conditions.map((c) => ({
              key: nextKey(),
              field: c.field,
              operator: c.operator,
              value: c.value,
            }))
          : [emptyCondition()],
      );
      setActions(
        editRule.actions.length > 0
          ? editRule.actions.map((a) => ({
              key: nextKey(),
              actionType: a.actionType,
              categoryId: a.categoryId ?? null,
              note: a.note ?? "",
            }))
          : [emptyAction()],
      );
    } else if (prefill) {
      setName(prefill.name);
      setConditions([
        {
          key: nextKey(),
          field: prefill.condition.field,
          operator: prefill.condition.operator,
          value: prefill.condition.value,
        },
      ]);
      setActions([
        {
          key: nextKey(),
          actionType: prefill.action.actionType ?? "assign_category",
          categoryId: prefill.action.categoryId ?? null,
          note: prefill.action.note ?? "",
        },
      ]);
    } else {
      setName("");
      setConditions([emptyCondition()]);
      setActions([emptyAction()]);
    }
    setSaveError("");
  }, [open, editRule, prefill]);

  async function loadCategories() {
    setCategories(await listCategories());
  }

  function updateCondition(key: number, patch: Partial<ConditionForm>) {
    setConditions((prev) =>
      prev.map((c) => {
        if (c.key !== key) return c;
        const updated = { ...c, ...patch };
        // Reset operator when field type changes
        if (patch.field && patch.field !== c.field) {
          const ops = operatorsForField(patch.field);
          if (!ops.find((o) => o.value === updated.operator)) {
            updated.operator = ops[0].value;
          }
        }
        return updated;
      }),
    );
  }

  function removeCondition(key: number) {
    setConditions((prev) => prev.filter((c) => c.key !== key));
  }

  function updateAction(key: number, patch: Partial<ActionForm>) {
    setActions((prev) => prev.map((a) => (a.key === key ? { ...a, ...patch } : a)));
  }

  function removeAction(key: number) {
    setActions((prev) => prev.filter((a) => a.key !== key));
  }

  function isSaveDisabled() {
    if (!name.trim()) return true;
    if (conditions.some((c) => !c.field || !c.operator || !c.value.trim())) return true;
    if (
      actions.some(
        (a) =>
          (a.actionType === "assign_category" && a.categoryId === null) ||
          (a.actionType === "set_note" && !a.note.trim()),
      )
    )
      return true;
    return false;
  }

  async function handleSave() {
    if (isSaveDisabled()) return;
    setSaving(true);
    setSaveError("");
    try {
      const input = {
        name: name.trim(),
        conditions: conditions.map(({ field, operator, value }) => ({ field, operator, value })),
        actions: actions.map(({ actionType, categoryId, note }) => ({
          actionType,
          categoryId: actionType === "assign_category" ? categoryId : null,
          note: actionType === "set_note" ? note.trim() : null,
        })),
      };

      let ruleId: number;
      if (isEditMode && editRule) {
        await updateRule(editRule.id, input);
        ruleId = editRule.id;
      } else {
        ruleId = await createRule(input);
      }

      let triggered = false;
      if (triggerRerunOnSave) {
        const { applyRules } = await import("@/lib/rules");
        await applyRules();
        triggered = true;
      }

      onSaved(ruleId, triggered);
    } catch (err) {
      setSaveError(String(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>{isEditMode ? "Edit Rule" : "New Rule"}</SheetTitle>
        </SheetHeader>

        <div className="mt-6 flex flex-col gap-6 px-1">
          {/* Name */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="rule-name">Name *</Label>
            <Input
              id="rule-name"
              placeholder="e.g. Starbucks Coffee"
              value={name}
              onChange={(e) => setName(e.target.value)}
              data-testid="rule-name"
            />
          </div>

          {/* Conditions */}
          <div className="flex flex-col gap-2">
            <Label>Conditions (all must match)</Label>
            {conditions.map((cond, idx) => (
              <div key={cond.key} className="flex items-center gap-2" data-testid={`condition-row-${idx}`}>
                <Select value={cond.field} onValueChange={(v) => updateCondition(cond.key, { field: v })}>
                  <SelectTrigger className="w-36" data-testid={`condition-field-${idx}`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ALL_FIELDS.map((f) => (
                      <SelectItem key={f.value} value={f.value}>
                        {f.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={cond.operator} onValueChange={(v) => updateCondition(cond.key, { operator: v })}>
                  <SelectTrigger className="w-32" data-testid={`condition-operator-${idx}`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {operatorsForField(cond.field).map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Input
                  className="flex-1"
                  placeholder="Value"
                  value={cond.value}
                  onChange={(e) => updateCondition(cond.key, { value: e.target.value })}
                  data-testid={`condition-value-${idx}`}
                />

                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => removeCondition(cond.key)}
                  disabled={conditions.length === 1}
                  aria-label="Remove condition"
                  data-testid={`condition-remove-${idx}`}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <Button
              variant="outline"
              size="sm"
              className="self-start"
              onClick={() => setConditions((prev) => [...prev, emptyCondition()])}
              data-testid="add-condition-button"
            >
              <Plus className="mr-1 h-3 w-3" /> Condition
            </Button>
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-2">
            <Label>Actions</Label>
            {actions.map((action, idx) => (
              <div key={action.key} className="flex items-center gap-2" data-testid={`action-row-${idx}`}>
                <Select
                  value={action.actionType}
                  onValueChange={(v) =>
                    updateAction(action.key, {
                      actionType: v as "assign_category" | "set_note",
                      categoryId: null,
                      note: "",
                    })
                  }
                >
                  <SelectTrigger className="w-40" data-testid={`action-type-${idx}`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ACTION_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {action.actionType === "assign_category" ? (
                  <div className="flex-1">
                    <CategoryCombobox
                      id={`action-category-${idx}`}
                      categories={categories}
                      value={action.categoryId}
                      onChange={(id) => updateAction(action.key, { categoryId: id })}
                    />
                  </div>
                ) : (
                  <Input
                    className="flex-1"
                    placeholder="Note text"
                    value={action.note}
                    onChange={(e) => updateAction(action.key, { note: e.target.value })}
                    data-testid={`action-note-${idx}`}
                  />
                )}

                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => removeAction(action.key)}
                  disabled={actions.length === 1}
                  aria-label="Remove action"
                  data-testid={`action-remove-${idx}`}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <Button
              variant="outline"
              size="sm"
              className="self-start"
              onClick={() => setActions((prev) => [...prev, emptyAction()])}
              data-testid="add-action-button"
            >
              <Plus className="mr-1 h-3 w-3" /> Action
            </Button>
          </div>

          {saveError && <p className="text-destructive text-sm">{saveError}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving || isSaveDisabled()}
              data-testid="rule-save-button"
            >
              {saving ? "Saving…" : "Save"}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
