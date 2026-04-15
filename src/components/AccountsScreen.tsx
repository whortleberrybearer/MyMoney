import { MoreHorizontal, Plus } from "lucide-react";
import React, { useEffect, useState } from "react";
import {
  AccountRow,
  deleteAccount,
  listAccountsWithPots,
  setAccountActive,
} from "@/lib/accounts";
import {
  closePot,
  deletePot,
  getPotBalance,
  reactivatePot,
} from "@/lib/pots";
import type { PotRow } from "@/lib/pots";
import { createPotTransfer } from "@/lib/transfers";
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
import { PotBalanceChart } from "./PotBalanceChart";
import { PotFormSheet } from "./PotFormSheet";
import { PotTransferDialog } from "./PotTransferDialog";
import { Tag } from "@/lib/reference-data";

interface AccountsScreenProps {
  tagId?: number | null;
  onTagCreated?: (tag: Tag) => void;
}

type PotDeleteTarget = { pot: PotRow; accountName: string };
type PotCloseTarget = { pot: PotRow; account: AccountRow; balance: number };

export function AccountsScreen({
  tagId = null,
  onTagCreated,
}: AccountsScreenProps = {}) {
  const [accounts, setAccounts] = useState<AccountRow[]>([]);
  const [showInactive, setShowInactive] = useState(false);
  // Per-account toggle for "show closed pots" keyed by account id
  const [showClosedPotsFor, setShowClosedPotsFor] = useState<
    Record<number, boolean>
  >({});
  // Per-account toggle for combined balance breakdown chart
  const [showBreakdownFor, setShowBreakdownFor] = useState<
    Record<number, boolean>
  >({});

  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<AccountRow | undefined>(
    undefined,
  );
  const [deleteTarget, setDeleteTarget] = useState<AccountRow | null>(null);

  // Pot state
  const [potFormOpen, setPotFormOpen] = useState(false);
  const [potFormAccount, setPotFormAccount] = useState<AccountRow | null>(null);
  const [editPotTarget, setEditPotTarget] = useState<PotRow | undefined>(
    undefined,
  );
  const [potDeleteTarget, setPotDeleteTarget] =
    useState<PotDeleteTarget | null>(null);
  const [potCloseTarget, setPotCloseTarget] = useState<PotCloseTarget | null>(
    null,
  );
  const [transferDialogOpen, setTransferDialogOpen] = useState(false);
  const [transferPot, setTransferPot] = useState<PotRow | null>(null);
  const [transferAccount, setTransferAccount] = useState<AccountRow | null>(
    null,
  );

  useEffect(() => {
    load();
  }, [showInactive, tagId]);

  async function load() {
    // Build per-account showClosed flags
    const anyShowClosed = Object.values(showClosedPotsFor).some(Boolean);
    // We always load with showClosed=true so pots are grouped; per-account
    // visibility is handled in the render. For simplicity we load all pots
    // always and filter in render.
    const rows = await listAccountsWithPots(showInactive, tagId, true);
    setAccounts(rows);
    // If showClosed state changed since last render, re-render handles it.
    if (anyShowClosed) {
      // Keep existing showClosedPotsFor; no reset needed.
    }
  }

  function toggleShowClosedPots(accountId: number) {
    setShowClosedPotsFor((prev) => ({
      ...prev,
      [accountId]: !prev[accountId],
    }));
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

  // --- Pot actions ---

  function openAddPot(account: AccountRow) {
    setPotFormAccount(account);
    setEditPotTarget(undefined);
    setPotFormOpen(true);
  }

  function openEditPot(pot: PotRow, account: AccountRow) {
    setPotFormAccount(account);
    setEditPotTarget(pot);
    setPotFormOpen(true);
  }

  function openTransfer(pot: PotRow, account: AccountRow) {
    setTransferPot(pot);
    setTransferAccount(account);
    setTransferDialogOpen(true);
  }

  async function handleClosePot(pot: PotRow, account: AccountRow) {
    const balance = await getPotBalance(pot.id);
    if (balance !== 0) {
      // Warn and confirm with auto-transfer
      setPotCloseTarget({ pot, account, balance });
    } else {
      await closePot(pot.id);
      await load();
    }
  }

  async function confirmClosePotWithTransfer() {
    if (!potCloseTarget) return;
    const { pot, account, balance } = potCloseTarget;
    // Auto-transfer: if balance is positive the pot has funds to return to account,
    // if negative the account owes the pot — in both cases we move the absolute
    // balance in the appropriate direction.
    const direction = balance > 0 ? "out_of_pot" : "into_pot";
    await createPotTransfer({
      potId: pot.id,
      accountId: account.id,
      amount: Math.abs(balance),
      date: new Date().toISOString().split("T")[0],
      direction,
      notes: `Auto-transfer on closing pot "${pot.name}"`,
    });
    await closePot(pot.id);
    setPotCloseTarget(null);
    await load();
  }

  async function handleReactivatePot(pot: PotRow) {
    await reactivatePot(pot.id);
    await load();
  }

  async function confirmDeletePot() {
    if (!potDeleteTarget) return;
    await deletePot(potDeleteTarget.pot.id);
    setPotDeleteTarget(null);
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
          {showInactive
            ? "No accounts found"
            : "No active accounts. Add one to get started."}
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
                <TableHead className="text-right">Balance</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {accounts.map((row) => {
                const showClosed = showClosedPotsFor[row.id] ?? false;
                const showBreakdown = showBreakdownFor[row.id] ?? false;
                const activePots = (row.pots ?? []).filter(
                  (p) => p.isActive === 1,
                );
                const visiblePots = (row.pots ?? []).filter(
                  (p) => p.isActive === 1 || showClosed,
                );
                const hasActivePots = activePots.length > 0;
                return (
                  <React.Fragment key={row.id}>
                    {/* Account row */}
                    <TableRow
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
                        {row.currentBalance.toFixed(2)}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              size="icon-sm"
                              variant="ghost"
                              aria-label="Account actions"
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openEdit(row)}>
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleToggleActive(row)}
                            >
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

                    {/* Pot child rows */}
                    {visiblePots.map((pot) => (
                      <TableRow
                        key={pot.id}
                        className={pot.isActive === 0 ? "opacity-40" : undefined}
                        data-testid="pot-row"
                      >
                        <TableCell />
                        <TableCell className="pl-8 text-sm">
                          <span className="text-muted-foreground mr-1">↳</span>
                          {pot.name}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            pot
                          </Badge>
                        </TableCell>
                        <TableCell />
                        <TableCell className="text-right tabular-nums text-sm">
                          {pot.currentBalance.toFixed(2)}
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                size="icon-sm"
                                variant="ghost"
                                aria-label="Pot actions"
                              >
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={() => openEditPot(pot, row)}
                              >
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => openTransfer(pot, row)}
                              >
                                Transfer
                              </DropdownMenuItem>
                              {pot.isActive === 1 ? (
                                <DropdownMenuItem
                                  onClick={() => handleClosePot(pot, row)}
                                >
                                  Close
                                </DropdownMenuItem>
                              ) : (
                                <DropdownMenuItem
                                  onClick={() => handleReactivatePot(pot)}
                                >
                                  Reactivate
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onClick={() =>
                                  setPotDeleteTarget({
                                    pot,
                                    accountName: row.name,
                                  })
                                }
                              >
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}

                    {/* Per-account footer: show closed pots toggle + add pot + breakdown toggle */}
                    <TableRow className="border-0">
                      <TableCell colSpan={6} className="py-1">
                        <div className="flex items-center gap-4 pl-8">
                          <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
                            <Switch
                              checked={showClosed}
                              onCheckedChange={() =>
                                toggleShowClosedPots(row.id)
                              }
                              aria-label={`Show closed pots for ${row.name}`}
                            />
                            Show closed pots
                          </label>
                          {hasActivePots && (
                            <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
                              <Switch
                                checked={showBreakdown}
                                onCheckedChange={() =>
                                  setShowBreakdownFor((prev) => ({
                                    ...prev,
                                    [row.id]: !prev[row.id],
                                  }))
                                }
                                aria-label={`Show balance breakdown for ${row.name}`}
                              />
                              Show breakdown
                            </label>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 gap-1 px-2 text-xs"
                            onClick={() => openAddPot(row)}
                            aria-label={`Add pot to ${row.name}`}
                          >
                            <Plus className="h-3 w-3" />
                            Add pot
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>

                    {/* Combined balance breakdown chart */}
                    {showBreakdown && hasActivePots && (
                      <TableRow className="border-0">
                        <TableCell colSpan={6} className="pb-2 pt-0">
                          <PotBalanceChart
                            accountName={row.name}
                            accountOwnBalance={row.currentBalance}
                            currency={row.currency}
                            pots={row.pots ?? []}
                          />
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Account form */}
      <AccountFormSheet
        open={formOpen}
        onOpenChange={setFormOpen}
        editAccount={editTarget}
        onSaved={load}
        onTagCreated={onTagCreated}
      />

      {/* Account delete confirmation */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete account?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete{" "}
              <strong>{deleteTarget?.name}</strong>? This cannot be undone.
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

      {/* Pot form */}
      {potFormAccount && (
        <PotFormSheet
          open={potFormOpen}
          onOpenChange={setPotFormOpen}
          account={potFormAccount}
          editPot={editPotTarget}
          onSaved={load}
          onTagCreated={onTagCreated}
        />
      )}

      {/* Pot transfer dialog */}
      {transferPot && transferAccount && (
        <PotTransferDialog
          open={transferDialogOpen}
          onOpenChange={setTransferDialogOpen}
          pot={transferPot}
          account={transferAccount}
          onTransferred={load}
        />
      )}

      {/* Pot delete confirmation */}
      <AlertDialog
        open={!!potDeleteTarget}
        onOpenChange={(o) => !o && setPotDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete pot permanently?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to permanently delete{" "}
              <strong>{potDeleteTarget?.pot.name}</strong> from{" "}
              <strong>{potDeleteTarget?.accountName}</strong>? All transactions
              associated with this pot will be permanently removed. This is
              irreversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeletePot}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete permanently
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Pot close with non-zero balance warning */}
      <AlertDialog
        open={!!potCloseTarget}
        onOpenChange={(o) => !o && setPotCloseTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Close pot with remaining balance?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{potCloseTarget?.pot.name}</strong> has a balance of{" "}
              <strong>
                {potCloseTarget
                  ? Math.abs(potCloseTarget.balance).toFixed(2)
                  : ""}
              </strong>
              . Closing this pot will automatically transfer the remaining
              balance back to{" "}
              <strong>{potCloseTarget?.account.name}</strong>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmClosePotWithTransfer}>
              Transfer & Close
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
