import { useEffect, useState } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Pencil, Plus, Trash2 } from "lucide-react";
import {
  deletePotAllocationRule,
  getPotAllocationRules,
  reorderPotAllocationRules,
  togglePotAllocationRuleActive,
  type PotAllocationRule,
} from "@/lib/pot-allocation-rules";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { PotAllocationRuleBuilderSheet } from "./PotAllocationRuleBuilderSheet";

// ---------------------------------------------------------------------------
// Sortable row
// ---------------------------------------------------------------------------

interface SortableRowProps {
  rule: PotAllocationRule;
  onToggle: (id: number) => void;
  onEdit: (rule: PotAllocationRule) => void;
  onDelete: (rule: PotAllocationRule) => void;
}

function conditionsSummary(rule: PotAllocationRule): string {
  if (rule.conditions.length === 0) return "No conditions";
  return rule.conditions
    .map((c) => `${c.field} ${c.operator} "${c.value}"`)
    .join(" and ");
}

function SortableRuleRow({ rule, onToggle, onEdit, onDelete }: SortableRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: rule.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3 rounded-md border bg-card px-3 py-2"
      data-testid={`par-rule-row-${rule.id}`}
    >
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab text-muted-foreground hover:text-foreground"
        aria-label="Drag to reorder"
        data-testid={`par-rule-drag-${rule.id}`}
      >
        <GripVertical className="h-4 w-4" />
      </button>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">{rule.name}</p>
        <p className="text-xs text-muted-foreground truncate">{conditionsSummary(rule)}</p>
      </div>

      <Switch
        checked={rule.isActive === 1}
        onCheckedChange={() => onToggle(rule.id)}
        aria-label={rule.isActive === 1 ? "Disable rule" : "Enable rule"}
        data-testid={`par-rule-toggle-${rule.id}`}
      />
      <span className="w-14 text-xs text-muted-foreground">
        {rule.isActive === 1 ? "Active" : "Off"}
      </span>

      <Button
        variant="ghost"
        size="icon"
        onClick={() => onEdit(rule)}
        aria-label="Edit rule"
        data-testid={`par-rule-edit-${rule.id}`}
      >
        <Pencil className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => onDelete(rule)}
        aria-label="Delete rule"
        data-testid={`par-rule-delete-${rule.id}`}
      >
        <Trash2 className="h-4 w-4 text-destructive" />
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab content
// ---------------------------------------------------------------------------

interface Props {
  accountId: number;
}

export function PotAllocationRulesTab({ accountId }: Props) {
  const [rules, setRules] = useState<PotAllocationRule[]>([]);
  const [ruleToDelete, setRuleToDelete] = useState<PotAllocationRule | null>(null);
  const [editingRule, setEditingRule] = useState<PotAllocationRule | null>(null);
  const [builderOpen, setBuilderOpen] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  useEffect(() => {
    load();
  }, [accountId]);

  async function load() {
    setRules(await getPotAllocationRules(accountId));
  }

  async function handleToggle(id: number) {
    await togglePotAllocationRuleActive(id);
    await load();
  }

  function handleEdit(rule: PotAllocationRule) {
    setEditingRule(rule);
    setBuilderOpen(true);
  }

  function handleNewRule() {
    setEditingRule(null);
    setBuilderOpen(true);
  }

  function handleDeleteClick(rule: PotAllocationRule) {
    setRuleToDelete(rule);
  }

  async function handleDeleteConfirm() {
    if (!ruleToDelete) return;
    await deletePotAllocationRule(ruleToDelete.id);
    setRuleToDelete(null);
    await load();
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = rules.findIndex((r) => r.id === active.id);
    const newIndex = rules.findIndex((r) => r.id === over.id);
    const reordered = arrayMove(rules, oldIndex, newIndex);
    setRules(reordered);
    await reorderPotAllocationRules(reordered.map((r) => r.id));
  }

  async function handleBuilderSaved() {
    setBuilderOpen(false);
    setEditingRule(null);
    await load();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Pot Allocation Rules
        </h2>
        <Button size="sm" onClick={handleNewRule} data-testid="par-new-rule-button">
          <Plus className="mr-1 h-4 w-4" />
          New Rule
        </Button>
      </div>

      {rules.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-md border border-dashed py-10 text-center" data-testid="par-empty-state">
          <p className="text-sm text-muted-foreground">No rules yet — create one to get started</p>
          <Button size="sm" variant="outline" className="mt-4" onClick={handleNewRule}>
            <Plus className="mr-1 h-4 w-4" />
            New Rule
          </Button>
        </div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={rules.map((r) => r.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-2" data-testid="par-rules-list">
              {rules.map((rule) => (
                <SortableRuleRow
                  key={rule.id}
                  rule={rule}
                  onToggle={handleToggle}
                  onEdit={handleEdit}
                  onDelete={handleDeleteClick}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {/* Delete confirmation dialog */}
      <AlertDialog open={ruleToDelete !== null} onOpenChange={(open) => !open && setRuleToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete rule?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete &quot;{ruleToDelete?.name}&quot; including all its
              conditions and actions. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="par-delete-cancel">Cancel</AlertDialogCancel>
            <Button
              variant="destructive"
              onClick={handleDeleteConfirm}
              data-testid="par-delete-confirm"
            >
              Delete
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Rule builder sheet */}
      <PotAllocationRuleBuilderSheet
        accountId={accountId}
        open={builderOpen}
        rule={editingRule}
        onSaved={handleBuilderSaved}
        onCancel={() => {
          setBuilderOpen(false);
          setEditingRule(null);
        }}
      />
    </div>
  );
}
