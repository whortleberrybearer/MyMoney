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
import { GripVertical, Pencil, Plus, RefreshCw, Trash2 } from "lucide-react";
import {
  applyRules,
  deleteRule,
  getRules,
  reorderRules,
  toggleRuleActive,
  type Rule,
} from "@/lib/rules";
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
import { RuleBuilderSheet } from "./RuleBuilderSheet";

// ---------------------------------------------------------------------------
// Sortable rule row
// ---------------------------------------------------------------------------

interface SortableRowProps {
  rule: Rule;
  onToggle: (id: number) => void;
  onEdit: (rule: Rule) => void;
  onDelete: (rule: Rule) => void;
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
      data-testid={`rule-row-${rule.id}`}
    >
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab text-muted-foreground hover:text-foreground"
        aria-label="Drag to reorder"
        data-testid={`rule-drag-${rule.id}`}
      >
        <GripVertical className="h-4 w-4" />
      </button>

      <span className="flex-1 text-sm font-medium">{rule.name}</span>

      <Switch
        checked={rule.isActive === 1}
        onCheckedChange={() => onToggle(rule.id)}
        aria-label={rule.isActive === 1 ? "Disable rule" : "Enable rule"}
        data-testid={`rule-toggle-${rule.id}`}
      />
      <span className="w-14 text-xs text-muted-foreground">
        {rule.isActive === 1 ? "Active" : "Off"}
      </span>

      <Button
        variant="ghost"
        size="icon"
        onClick={() => onEdit(rule)}
        aria-label="Edit rule"
        data-testid={`rule-edit-${rule.id}`}
      >
        <Pencil className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => onDelete(rule)}
        aria-label="Delete rule"
        data-testid={`rule-delete-${rule.id}`}
      >
        <Trash2 className="h-4 w-4 text-destructive" />
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------

interface Props {
  onBack: () => void;
}

export function RulesManagementScreen({ onBack }: Props) {
  const [rules, setRules] = useState<Rule[]>([]);
  const [ruleToDelete, setRuleToDelete] = useState<Rule | null>(null);
  const [editingRule, setEditingRule] = useState<Rule | null>(null);
  const [builderOpen, setBuilderOpen] = useState(false);
  const [rerunConfirmOpen, setRerunConfirmOpen] = useState(false);
  const [rerunToast, setRerunToast] = useState("");

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setRules(await getRules());
  }

  async function handleToggle(id: number) {
    await toggleRuleActive(id);
    await load();
  }

  function handleEdit(rule: Rule) {
    setEditingRule(rule);
    setBuilderOpen(true);
  }

  function handleNewRule() {
    setEditingRule(null);
    setBuilderOpen(true);
  }

  function handleDeleteClick(rule: Rule) {
    setRuleToDelete(rule);
  }

  async function handleDeleteConfirm() {
    if (!ruleToDelete) return;
    await deleteRule(ruleToDelete.id);
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
    await reorderRules(reordered.map((r) => r.id));
  }

  async function handleRerunConfirm() {
    setRerunConfirmOpen(false);
    const count = await applyRules();
    setRerunToast(`Rules applied — ${count} transaction${count === 1 ? "" : "s"} categorised`);
    setTimeout(() => setRerunToast(""), 4000);
  }

  async function handleBuilderSaved() {
    setBuilderOpen(false);
    setEditingRule(null);
    await load();
  }

  return (
    <div className="flex h-screen flex-col">
      <header className="flex items-center justify-between border-b px-6 py-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onBack} data-testid="rules-back-button">
            ← Back
          </Button>
          <h1 className="text-lg font-semibold">Categorisation Rules</h1>
        </div>
        <Button onClick={handleNewRule} data-testid="new-rule-button">
          <Plus className="mr-1 h-4 w-4" /> New Rule
        </Button>
      </header>

      <div className="flex-1 overflow-auto p-6">
        {rules.length === 0 ? (
          <div
            className="flex flex-col items-center justify-center gap-2 py-16 text-muted-foreground"
            data-testid="rules-empty-state"
          >
            <p>No rules yet — create one to get started.</p>
            <Button variant="outline" onClick={handleNewRule}>
              <Plus className="mr-1 h-4 w-4" /> New Rule
            </Button>
          </div>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={rules.map((r) => r.id)} strategy={verticalListSortingStrategy}>
              <div className="flex flex-col gap-2" data-testid="rules-list">
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

        <div className="mt-8 flex justify-end">
          <Button
            variant="outline"
            onClick={() => setRerunConfirmOpen(true)}
            data-testid="rerun-button"
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Re-run rules on all transactions
          </Button>
        </div>

        {rerunToast && (
          <div
            className="fixed bottom-6 right-6 rounded-md border bg-card px-4 py-2 text-sm shadow-lg"
            data-testid="rerun-toast"
          >
            {rerunToast}
          </div>
        )}
      </div>

      {/* Delete confirmation */}
      <AlertDialog open={ruleToDelete !== null} onOpenChange={(open) => !open && setRuleToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete rule?</AlertDialogTitle>
            <AlertDialogDescription>
              "{ruleToDelete?.name}" will be permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <Button variant="destructive" onClick={handleDeleteConfirm} data-testid="delete-confirm-button">
              Delete
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Re-run confirmation */}
      <AlertDialog open={rerunConfirmOpen} onOpenChange={setRerunConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Re-run rules on all transactions?</AlertDialogTitle>
            <AlertDialogDescription>
              This will overwrite the category on all non-void transactions, including ones you have
              manually categorised.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <Button onClick={handleRerunConfirm} data-testid="rerun-confirm-button">
              Re-run
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Rule builder */}
      <RuleBuilderSheet
        open={builderOpen}
        onOpenChange={(open) => {
          setBuilderOpen(open);
          if (!open) setEditingRule(null);
        }}
        editRule={editingRule ?? undefined}
        onSaved={handleBuilderSaved}
      />
    </div>
  );
}
