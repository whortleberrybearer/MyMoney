import { MoreHorizontal, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { AccountRow, deleteAccount, listAccounts, setAccountActive } from "@/lib/accounts";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AccountFormSheet } from "./AccountFormSheet";
import { Tag } from "@/lib/reference-data";

interface AccountsScreenProps {
  tagId?: number | null;
  onTagCreated?: (tag: Tag) => void;
}

export function AccountsScreen({ tagId = null, onTagCreated }: AccountsScreenProps = {}) {
  const [accounts, setAccounts] = useState<AccountRow[]>([]);
  const [showInactive, setShowInactive] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<AccountRow | undefined>(undefined);
  const [deleteTarget, setDeleteTarget] = useState<AccountRow | null>(null);

  useEffect(() => {
    load();
  }, [showInactive, tagId]);

  async function load() {
    setAccounts(await listAccounts(showInactive, tagId));
  }

  function openCreate() {
    setEditTarget(undefined);
    setFormOpen(true);
  }

  function openEdit(row: AccountRow) {
    setEditTarget(row);
    setFormOpen(true);
  }

  async function handleToggleActive(row: AccountRow) {
    await setAccountActive(row.id, row.isActive === 0);
    await load();
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    await deleteAccount(deleteTarget.id);
    setDeleteTarget(null);
    await load();
  }

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex items-center justify-between border-b px-6 py-3">
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">Show inactive</span>
          <Switch
            checked={showInactive}
            onCheckedChange={setShowInactive}
            aria-label="Show inactive accounts"
          />
        </div>
        <Button size="sm" className="gap-1" onClick={openCreate}>
          <Plus className="h-4 w-4" />
          Add Account
        </Button>
      </div>

      {accounts.length === 0 ? (
        <div className="flex flex-1 items-center justify-center text-muted-foreground">
          {showInactive ? "No accounts found" : "No active accounts. Add one to get started."}
        </div>
      ) : (
        <div className="overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Institution</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Currency</TableHead>
                <TableHead className="text-right">Opening Balance</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {accounts.map((row) => (
                <TableRow
                  key={row.id}
                  className={row.isActive === 0 ? "opacity-40" : undefined}
                >
                  <TableCell className="text-muted-foreground text-sm">
                    {row.institutionName}
                  </TableCell>
                  <TableCell className="font-medium">{row.name}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{row.accountTypeName}</Badge>
                  </TableCell>
                  <TableCell className="text-sm">{row.currency}</TableCell>
                  <TableCell className="text-right tabular-nums text-sm">
                    {row.openingBalance.toFixed(2)}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          aria-label="Row actions"
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEdit(row)}>
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleToggleActive(row)}>
                          {row.isActive === 1 ? "Deactivate" : "Reactivate"}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => setDeleteTarget(row)}
                        >
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <AccountFormSheet
        open={formOpen}
        onOpenChange={setFormOpen}
        editAccount={editTarget}
        onSaved={load}
        onTagCreated={onTagCreated}
      />

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete account?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{deleteTarget?.name}</strong>? This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
