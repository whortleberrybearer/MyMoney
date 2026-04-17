import { Check, Plus, Trash2, X } from "lucide-react";
import { useEffect, useState } from "react";
import {
  CategoryInUseError,
  createCategory,
  deleteCategory,
  listCategories,
  type Category,
} from "@/lib/categories";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type DeleteState =
  | { kind: "none" }
  | { kind: "confirm"; category: Category }
  | { kind: "replacement"; category: Category; transactionCount: number; replacementId: string };

export function CategoryManagementDialog({ open, onOpenChange }: Props) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [addingNew, setAddingNew] = useState(false);
  const [newName, setNewName] = useState("");
  const [addError, setAddError] = useState("");
  const [deleteState, setDeleteState] = useState<DeleteState>({ kind: "none" });
  const [deleteError, setDeleteError] = useState("");

  useEffect(() => {
    if (open) {
      load();
    }
  }, [open]);

  async function load() {
    setCategories(await listCategories());
  }

  function startAdd() {
    setAddingNew(true);
    setNewName("");
    setAddError("");
  }

  function cancelAdd() {
    setAddingNew(false);
    setNewName("");
    setAddError("");
  }

  async function saveAdd() {
    if (!newName.trim()) {
      setAddError("Category name is required");
      return;
    }
    try {
      await createCategory(newName);
      setAddingNew(false);
      setNewName("");
      setAddError("");
      await load();
    } catch (err) {
      setAddError(String(err).replace("Error: ", ""));
    }
  }

  function requestDelete(cat: Category) {
    setDeleteError("");
    setDeleteState({ kind: "confirm", category: cat });
  }

  async function confirmSimpleDelete() {
    if (deleteState.kind !== "confirm") return;
    const cat = deleteState.category;
    try {
      await deleteCategory(cat.id);
      setDeleteState({ kind: "none" });
      await load();
    } catch (err) {
      if (err instanceof CategoryInUseError) {
        setDeleteState({
          kind: "replacement",
          category: cat,
          transactionCount: err.transactionCount,
          replacementId: "",
        });
      } else {
        setDeleteError(String(err).replace("Error: ", ""));
        setDeleteState({ kind: "none" });
      }
    }
  }

  async function confirmReplacementDelete() {
    if (deleteState.kind !== "replacement" || !deleteState.replacementId) return;
    const cat = deleteState.category;
    try {
      await deleteCategory(cat.id, Number(deleteState.replacementId));
      setDeleteState({ kind: "none" });
      await load();
    } catch (err) {
      setDeleteError(String(err).replace("Error: ", ""));
      setDeleteState({ kind: "none" });
    }
  }

  function closeDeleteDialogs() {
    setDeleteState({ kind: "none" });
  }

  const replacementOptions =
    deleteState.kind === "replacement"
      ? categories.filter((c) => c.id !== deleteState.category.id)
      : [];

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Manage Categories</DialogTitle>
          </DialogHeader>

          {deleteError && (
            <p className="text-sm text-destructive" data-testid="delete-error">
              {deleteError}
            </p>
          )}

          <div className="flex flex-col gap-1">
            {categories.map((cat) => (
              <div
                key={cat.id}
                className="flex items-center gap-2 rounded px-2 py-1 hover:bg-muted"
                data-testid={`category-row-${cat.id}`}
              >
                <span className="flex-1 text-sm">
                  {cat.name}
                  {cat.isSystem === 1 && (
                    <span className="ml-1.5 text-xs text-muted-foreground">
                      (system)
                    </span>
                  )}
                </span>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  onClick={() => requestDelete(cat)}
                  aria-label={`Delete ${cat.name}`}
                  disabled={cat.isSystem === 1}
                  className="text-destructive hover:text-destructive disabled:opacity-30"
                  data-testid={`delete-btn-${cat.id}`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}

            {addingNew ? (
              <div className="flex flex-col gap-1 pt-1">
                <div className="flex items-center gap-2">
                  <Input
                    value={newName}
                    onChange={(e) => {
                      setNewName(e.target.value);
                      setAddError("");
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") saveAdd();
                      if (e.key === "Escape") cancelAdd();
                    }}
                    placeholder="Category name"
                    autoFocus
                    className="flex-1"
                    data-testid="new-category-input"
                  />
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    onClick={saveAdd}
                    aria-label="Save"
                    data-testid="save-new-category"
                  >
                    <Check className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    onClick={cancelAdd}
                    aria-label="Cancel"
                    data-testid="cancel-new-category"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                {addError && (
                  <p className="text-xs text-destructive" data-testid="add-error">
                    {addError}
                  </p>
                )}
              </div>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                className="mt-1 w-fit gap-1"
                onClick={startAdd}
                data-testid="add-category-btn"
              >
                <Plus className="h-4 w-4" />
                Add Category
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Simple delete confirmation */}
      <AlertDialog
        open={deleteState.kind === "confirm"}
        onOpenChange={(o) => !o && closeDeleteDialogs()}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete category?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete{" "}
              <strong>
                {deleteState.kind === "confirm" ? deleteState.category.name : ""}
              </strong>
              ? This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="delete-cancel">Cancel</AlertDialogCancel>
            <Button
              variant="destructive"
              onClick={confirmSimpleDelete}
              data-testid="delete-confirm"
            >
              Delete
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Replacement picker for in-use categories */}
      <AlertDialog
        open={deleteState.kind === "replacement"}
        onOpenChange={(o) => !o && closeDeleteDialogs()}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete "
              {deleteState.kind === "replacement"
                ? deleteState.category.name
                : ""}
              "
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deleteState.kind === "replacement" && (
                <>
                  <strong>{deleteState.category.name}</strong> is assigned to{" "}
                  {deleteState.transactionCount} transaction
                  {deleteState.transactionCount !== 1 ? "s" : ""}. Choose a
                  replacement category:
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>

          <Select
            value={
              deleteState.kind === "replacement" ? deleteState.replacementId : ""
            }
            onValueChange={(v) =>
              deleteState.kind === "replacement" &&
              setDeleteState({ ...deleteState, replacementId: v })
            }
          >
            <SelectTrigger data-testid="replacement-select">
              <SelectValue placeholder="Select replacement..." />
            </SelectTrigger>
            <SelectContent>
              {replacementOptions.map((c) => (
                <SelectItem key={c.id} value={String(c.id)}>
                  {c.name}
                  {c.isSystem === 1 && (
                    <span className="ml-1 text-xs text-muted-foreground">
                      (system)
                    </span>
                  )}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <AlertDialogFooter>
            <AlertDialogCancel data-testid="replacement-cancel">
              Cancel
            </AlertDialogCancel>
            <Button
              variant="destructive"
              onClick={confirmReplacementDelete}
              disabled={
                deleteState.kind !== "replacement" || !deleteState.replacementId
              }
              data-testid="replacement-confirm"
            >
              Delete and Reassign
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
