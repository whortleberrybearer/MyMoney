import { Pencil, Plus, Trash2, X, Check } from "lucide-react";
import { useEffect, useState } from "react";
import {
  createInstitution,
  deleteInstitution,
  Institution,
  listInstitutions,
  updateInstitution,
} from "@/lib/institutions";
import {
  AlertDialog,
  AlertDialogAction,
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

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function InstitutionManagementDialog({ open, onOpenChange }: Props) {
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingName, setEditingName] = useState("");
  const [editError, setEditError] = useState("");
  const [addingNew, setAddingNew] = useState(false);
  const [newName, setNewName] = useState("");
  const [addError, setAddError] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<Institution | null>(null);
  const [deleteError, setDeleteError] = useState("");

  useEffect(() => {
    if (open) {
      load();
    }
  }, [open]);

  async function load() {
    setInstitutions(await listInstitutions());
  }

  function startEdit(inst: Institution) {
    setEditingId(inst.id);
    setEditingName(inst.name);
    setEditError("");
  }

  function cancelEdit() {
    setEditingId(null);
    setEditingName("");
    setEditError("");
  }

  async function saveEdit(id: number) {
    if (!editingName.trim()) {
      setEditError("Name is required");
      return;
    }
    try {
      await updateInstitution(id, editingName);
      setEditingId(null);
      setEditingName("");
      setEditError("");
      await load();
    } catch (err) {
      setEditError(String(err).replace("Error: ", ""));
    }
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
      setAddError("Name is required");
      return;
    }
    try {
      await createInstitution(newName);
      setAddingNew(false);
      setNewName("");
      setAddError("");
      await load();
    } catch (err) {
      setAddError(String(err).replace("Error: ", ""));
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    try {
      await deleteInstitution(deleteTarget.id);
      setDeleteTarget(null);
      setDeleteError("");
      await load();
    } catch (err) {
      setDeleteError(String(err).replace("Error: ", ""));
      setDeleteTarget(null);
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Manage Institutions</DialogTitle>
          </DialogHeader>

          {deleteError && (
            <p className="text-sm text-destructive">{deleteError}</p>
          )}

          <div className="flex flex-col gap-1">
            {institutions.map((inst) =>
              editingId === inst.id ? (
                <div key={inst.id} className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <Input
                      value={editingName}
                      onChange={(e) => {
                        setEditingName(e.target.value);
                        setEditError("");
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") saveEdit(inst.id);
                        if (e.key === "Escape") cancelEdit();
                      }}
                      autoFocus
                      className="flex-1"
                    />
                    <Button size="icon-sm" variant="ghost" onClick={() => saveEdit(inst.id)} aria-label="Save">
                      <Check className="h-4 w-4" />
                    </Button>
                    <Button size="icon-sm" variant="ghost" onClick={cancelEdit} aria-label="Cancel">
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  {editError && <p className="text-xs text-destructive">{editError}</p>}
                </div>
              ) : (
                <div key={inst.id} className="flex items-center gap-2 rounded px-2 py-1 hover:bg-muted">
                  <span className="flex-1 text-sm">{inst.name}</span>
                  <Button size="icon-sm" variant="ghost" onClick={() => startEdit(inst)} aria-label="Edit">
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    onClick={() => { setDeleteError(""); setDeleteTarget(inst); }}
                    aria-label="Delete"
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ),
            )}

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
                    placeholder="Institution name"
                    autoFocus
                    className="flex-1"
                  />
                  <Button size="icon-sm" variant="ghost" onClick={saveAdd} aria-label="Save">
                    <Check className="h-4 w-4" />
                  </Button>
                  <Button size="icon-sm" variant="ghost" onClick={cancelAdd} aria-label="Cancel">
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                {addError && <p className="text-xs text-destructive">{addError}</p>}
              </div>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                className="mt-1 w-fit gap-1"
                onClick={startAdd}
              >
                <Plus className="h-4 w-4" />
                Add Institution
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete institution?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{deleteTarget?.name}</strong>? This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
