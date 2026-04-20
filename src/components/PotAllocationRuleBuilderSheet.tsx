import { useEffect, useState } from "react";
import { Plus, X } from "lucide-react";
import { listPots, type PotRow } from "@/lib/pots";
import {
  createPotAllocationRule,
  updatePotAllocationRule,
  type PotAllocationRule,
} from "@/lib/pot-allocation-rules";
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

const CONDITION_FIELDS = [
  { value: "description", label: "Description" },
  { value: "reference", label: "Reference" },
  { value: "amount", label: "Amount" },
  { value: "transaction_type", label: "Transaction type" },
] as const;

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

type ConditionField = (typeof CONDITION_FIELDS)[number]["value"];
type ConditionOperator =
  | (typeof TEXT_OPERATORS)[number]["value"]
  | (typeof NUMERIC_OPERATORS)[number]["value"];

function isConditionField(value: string): value is ConditionField {
  return CONDITION_FIELDS.some((f) => f.value === value);
}

function isConditionOperator(value: string): value is ConditionOperator {
  return [...TEXT_OPERATORS, ...NUMERIC_OPERATORS].some(
    (op) => op.value === value,
  );
}

function operatorsForField(field: ConditionField) {
  return field === "amount" ? NUMERIC_OPERATORS : TEXT_OPERATORS;
}

// ---------------------------------------------------------------------------
// Local form types
// ---------------------------------------------------------------------------

type ConditionForm = {
  key: number;
  field: ConditionField;
  operator: ConditionOperator;
  value: string;
};

type ActionForm = {
  key: number;
  potId: string;
  allocationValue: string;
};

let keyCounter = 0;
function nextKey() {
  return ++keyCounter;
}

function emptyCondition(): ConditionForm {
  return {
    key: nextKey(),
    field: "description",
    operator: "contains",
    value: "",
  };
}

function emptyAction(): ActionForm {
  return { key: nextKey(), potId: "", allocationValue: "" };
}

function isConditionComplete(c: ConditionForm): boolean {
  return (
    c.field.length > 0 && c.operator.length > 0 && c.value.trim().length > 0
  );
}

function isActionComplete(a: ActionForm): boolean {
  if (!a.potId) return false;
  const num = Number(a.allocationValue);
  return !isNaN(num) && num > 0;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface Props {
  accountId: number;
  open: boolean;
  rule: PotAllocationRule | null;
  onSaved: () => void;
  onCancel: () => void;
}

export function PotAllocationRuleBuilderSheet({
  accountId,
  open,
  rule,
  onSaved,
  onCancel,
}: Props) {
  const [name, setName] = useState("");
  const [conditions, setConditions] = useState<ConditionForm[]>([
    emptyCondition(),
  ]);
  const [actions, setActions] = useState<ActionForm[]>([emptyAction()]);
  const [pots, setPots] = useState<PotRow[]>([]);
  const [saving, setSaving] = useState(false);

  // Load active pots for the account
  useEffect(() => {
    if (open) {
      listPots(accountId, false).then(setPots);
    }
  }, [open, accountId]);

  // Populate form from existing rule when editing
  useEffect(() => {
    if (open && rule) {
      setName(rule.name);
      setConditions(
        rule.conditions.map((c) => ({
          field: isConditionField(c.field) ? c.field : "description",
          operator: isConditionOperator(c.operator) ? c.operator : "contains",
          key: nextKey(),
          value: c.value,
        })),
      );
      setActions(
        rule.actions.map((a) => ({
          key: nextKey(),
          potId: String(a.potId),
          allocationValue: String(a.allocationValue),
        })),
      );
    } else if (open && !rule) {
      setName("");
      setConditions([emptyCondition()]);
      setActions([emptyAction()]);
    }
  }, [open, rule]);

  const canSave =
    name.trim().length > 0 &&
    conditions.length > 0 &&
    conditions.every(isConditionComplete) &&
    actions.length > 0 &&
    actions.every(isActionComplete);

  // ---------------------------------------------------------------------------
  // Condition helpers
  // ---------------------------------------------------------------------------

  function updateCondition(key: number, update: Partial<ConditionForm>) {
    setConditions((prev) =>
      prev.map((c) => {
        if (c.key !== key) return c;
        const updated = { ...c, ...update };
        // Reset operator when field changes if current operator is no longer valid
        if (update.field) {
          const validOps = operatorsForField(update.field).map((o) => o.value);
          if (!validOps.includes(updated.operator)) {
            updated.operator = validOps[0];
          }
        }
        return updated;
      }),
    );
  }

  function addCondition() {
    setConditions((prev) => [...prev, emptyCondition()]);
  }

  function removeCondition(key: number) {
    setConditions((prev) => prev.filter((c) => c.key !== key));
  }

  // ---------------------------------------------------------------------------
  // Action helpers
  // ---------------------------------------------------------------------------

  function updateAction(key: number, update: Partial<ActionForm>) {
    setActions((prev) =>
      prev.map((a) => (a.key === key ? { ...a, ...update } : a)),
    );
  }

  function addAction() {
    setActions((prev) => [...prev, emptyAction()]);
  }

  function removeAction(key: number) {
    setActions((prev) => prev.filter((a) => a.key !== key));
  }

  // ---------------------------------------------------------------------------
  // Save
  // ---------------------------------------------------------------------------

  async function handleSave() {
    if (!canSave) return;
    setSaving(true);

    const input = {
      name: name.trim(),
      conditions: conditions.map((c) => ({
        field: c.field,
        operator: c.operator,
        value: c.value,
      })),
      actions: actions.map((a) => ({
        potId: Number(a.potId),
        allocationValue: Number(a.allocationValue),
      })),
    };

    try {
      if (rule) {
        await updatePotAllocationRule(rule.id, input);
      } else {
        await createPotAllocationRule(accountId, input);
      }
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={(isOpen) => !isOpen && onCancel()}>
      <SheetContent className="w-full max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>
            {rule ? "Edit Rule" : "New Pot Allocation Rule"}
          </SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Name */}
          <div className="space-y-1">
            <Label htmlFor="par-name">Name *</Label>
            <Input
              id="par-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Salary split"
              data-testid="par-name-input"
            />
          </div>

          {/* Conditions */}
          <div className="space-y-2">
            <Label>Conditions (all must match)</Label>
            {conditions.map((cond, idx) => (
              <div
                key={cond.key}
                className="flex items-center gap-2"
                data-testid={`par-condition-row-${idx}`}
              >
                <Select
                  value={cond.field}
                  onValueChange={(v) => {
                    if (isConditionField(v))
                      updateCondition(cond.key, { field: v });
                  }}
                >
                  <SelectTrigger
                    className="w-36"
                    data-testid={`par-cond-field-${idx}`}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CONDITION_FIELDS.map((f) => (
                      <SelectItem key={f.value} value={f.value}>
                        {f.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select
                  value={cond.operator}
                  onValueChange={(v) => {
                    if (isConditionOperator(v))
                      updateCondition(cond.key, { operator: v });
                  }}
                >
                  <SelectTrigger
                    className="w-32"
                    data-testid={`par-cond-operator-${idx}`}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {operatorsForField(cond.field).map((op) => (
                      <SelectItem key={op.value} value={op.value}>
                        {op.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Input
                  className="flex-1"
                  value={cond.value}
                  onChange={(e) =>
                    updateCondition(cond.key, { value: e.target.value })
                  }
                  placeholder="Value"
                  data-testid={`par-cond-value-${idx}`}
                />

                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => removeCondition(cond.key)}
                  disabled={conditions.length === 1}
                  aria-label="Remove condition"
                  data-testid={`par-cond-remove-${idx}`}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <Button
              variant="outline"
              size="sm"
              onClick={addCondition}
              data-testid="par-add-condition"
            >
              <Plus className="mr-1 h-4 w-4" />
              Condition
            </Button>
          </div>

          {/* Actions */}
          <div className="space-y-2">
            <Label>Pot Actions</Label>
            {actions.map((action, idx) => (
              <div
                key={action.key}
                className="flex items-center gap-2"
                data-testid={`par-action-row-${idx}`}
              >
                <Select
                  value={action.potId}
                  onValueChange={(v) => updateAction(action.key, { potId: v })}
                >
                  <SelectTrigger
                    className="flex-1"
                    data-testid={`par-action-pot-${idx}`}
                  >
                    <SelectValue placeholder="Select pot..." />
                  </SelectTrigger>
                  <SelectContent>
                    {pots.map((p) => (
                      <SelectItem key={p.id} value={String(p.id)}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Input
                  className="w-28"
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={action.allocationValue}
                  onChange={(e) =>
                    updateAction(action.key, {
                      allocationValue: e.target.value,
                    })
                  }
                  placeholder="Amount"
                  data-testid={`par-action-amount-${idx}`}
                />

                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => removeAction(action.key)}
                  disabled={actions.length === 1}
                  aria-label="Remove action"
                  data-testid={`par-action-remove-${idx}`}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <Button
              variant="outline"
              size="sm"
              onClick={addAction}
              data-testid="par-add-pot"
            >
              <Plus className="mr-1 h-4 w-4" />
              Add Pot
            </Button>
          </div>

          {/* Footer buttons */}
          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="outline"
              onClick={onCancel}
              data-testid="par-builder-cancel"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={!canSave || saving}
              data-testid="par-builder-save"
            >
              {saving ? "Saving…" : "Save"}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
