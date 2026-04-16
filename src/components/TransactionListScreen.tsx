import { ArrowLeft, ChevronDown, ChevronUp, MoreHorizontal, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import {
  deleteTransaction,
  listTransactions,
  type TransactionFilters,
  type TransactionRow,
  type TransactionSort,
} from "@/lib/transactions";
import { listCategories, type Category } from "@/lib/reference-data";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TransactionFormSheet } from "./TransactionFormSheet";

interface Props {
  accountId: number;
  accountName: string;
  onBack: () => void;
}

type SortCol = "date" | "amount";

export function TransactionListScreen({ accountId, accountName, onBack }: Props) {
  const [transactions, setTransactions] = useState<TransactionRow[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  // Sort state
  const [sortCol, setSortCol] = useState<SortCol>("date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  // Filter state
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [filterType, setFilterType] = useState("");
  const [filterReference, setFilterReference] = useState("");
  const [filterPayee, setFilterPayee] = useState("");

  // Form sheet
  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<TransactionRow | undefined>(undefined);

  // Delete dialog
  const [deleteTarget, setDeleteTarget] = useState<TransactionRow | null>(null);

  useEffect(() => {
    loadCategories();
  }, []);

  useEffect(() => {
    load();
  }, [accountId, sortCol, sortDir, fromDate, toDate, filterCategory, filterType, filterReference, filterPayee]);

  async function loadCategories() {
    setCategories(await listCategories());
  }

  async function load() {
    setLoading(true);
    try {
      const sort: TransactionSort =
        sortCol === "date"
          ? sortDir === "desc" ? "date-desc" : "date-asc"
          : sortDir === "desc" ? "amount-desc" : "amount-asc";

      const filters: TransactionFilters = {};
      if (fromDate) filters.fromDate = fromDate;
      if (toDate) filters.toDate = toDate;
      if (filterCategory) filters.categoryId = Number(filterCategory);
      if (filterType) filters.type = filterType;
      if (filterReference) filters.reference = filterReference;
      if (filterPayee) filters.payee = filterPayee;

      const rows = await listTransactions(accountId, filters, sort);
      setTransactions(rows);
    } finally {
      setLoading(false);
    }
  }

  function handleSortClick(col: SortCol) {
    if (sortCol === col) {
      setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    } else {
      setSortCol(col);
      setSortDir("desc");
    }
  }

  function SortIcon({ col }: { col: SortCol }) {
    if (sortCol !== col) return null;
    return sortDir === "desc" ? (
      <ChevronDown className="ml-1 inline h-3 w-3" />
    ) : (
      <ChevronUp className="ml-1 inline h-3 w-3" />
    );
  }

  function openAdd() {
    setEditTarget(undefined);
    setFormOpen(true);
  }

  function openEdit(tx: TransactionRow) {
    setEditTarget(tx);
    setFormOpen(true);
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    await deleteTransaction(deleteTarget.id);
    setDeleteTarget(null);
    await load();
  }

  function typeBadge(type: string) {
    if (type === "imported") {
      return <Badge variant="secondary">imported</Badge>;
    }
    if (type === "virtual_transfer") {
      return (
        <Badge variant="outline" className="italic text-muted-foreground">
          transfer
        </Badge>
      );
    }
    return <Badge variant="outline">manual</Badge>;
  }

  const hasFilters =
    fromDate || toDate || filterCategory || filterType || filterReference || filterPayee;

  return (
    <div className="flex h-screen flex-col">
      {/* Header */}
      <header className="flex items-center gap-3 border-b px-6 py-3">
        <Button variant="ghost" size="icon" onClick={onBack} aria-label="Back">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <span className="font-semibold flex-1">{accountName}</span>
        <Button size="sm" className="gap-1" onClick={openAdd} data-testid="add-transaction-btn">
          <Plus className="h-4 w-4" />
          Add Transaction
        </Button>
      </header>

      {/* Filter bar */}
      <div className="border-b px-6 py-3">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1">
            <Label className="text-xs text-muted-foreground">From</Label>
            <Input
              type="date"
              className="h-8 w-36 text-sm"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              data-testid="filter-from-date"
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-xs text-muted-foreground">To</Label>
            <Input
              type="date"
              className="h-8 w-36 text-sm"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              data-testid="filter-to-date"
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-xs text-muted-foreground">Category</Label>
            <Select value={filterCategory} onValueChange={setFilterCategory}>
              <SelectTrigger className="h-8 w-36 text-sm" data-testid="filter-category">
                <SelectValue placeholder="All" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={String(c.id)}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-xs text-muted-foreground">Type</Label>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="h-8 w-36 text-sm" data-testid="filter-type">
                <SelectValue placeholder="All" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All</SelectItem>
                <SelectItem value="imported">Imported</SelectItem>
                <SelectItem value="manual">Manual</SelectItem>
                <SelectItem value="virtual_transfer">Transfer</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-xs text-muted-foreground">Reference</Label>
            <Input
              className="h-8 w-36 text-sm"
              placeholder="Filter…"
              value={filterReference}
              onChange={(e) => setFilterReference(e.target.value)}
              data-testid="filter-reference"
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-xs text-muted-foreground">Payee</Label>
            <Input
              className="h-8 w-36 text-sm"
              placeholder="Filter…"
              value={filterPayee}
              onChange={(e) => setFilterPayee(e.target.value)}
              data-testid="filter-payee"
            />
          </div>
          {hasFilters && (
            <Button
              size="sm"
              variant="ghost"
              className="h-8 text-xs"
              onClick={() => {
                setFromDate("");
                setToDate("");
                setFilterCategory("");
                setFilterType("");
                setFilterReference("");
                setFilterPayee("");
              }}
            >
              Clear filters
            </Button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="flex h-32 items-center justify-center text-muted-foreground">
            Loading…
          </div>
        ) : transactions.length === 0 ? (
          <div
            className="flex h-32 items-center justify-center text-muted-foreground"
            data-testid="empty-state"
          >
            {hasFilters ? "No transactions match your filters." : "No transactions yet."}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead
                  className="cursor-pointer select-none"
                  onClick={() => handleSortClick("date")}
                  data-testid="col-date"
                >
                  Date
                  <SortIcon col="date" />
                </TableHead>
                <TableHead>Payee</TableHead>
                <TableHead>Notes</TableHead>
                <TableHead
                  className="cursor-pointer select-none text-right"
                  onClick={() => handleSortClick("amount")}
                  data-testid="col-amount"
                >
                  Amount
                  <SortIcon col="amount" />
                </TableHead>
                <TableHead>Category</TableHead>
                <TableHead className="text-right">Balance</TableHead>
                <TableHead>Reference</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {transactions.map((tx) => (
                <TableRow
                  key={tx.id}
                  className={tx.type === "virtual_transfer" ? "italic text-muted-foreground" : undefined}
                  data-testid={`tx-row-${tx.id}`}
                  data-tx-type={tx.type}
                >
                  <TableCell className="text-sm tabular-nums">{tx.date}</TableCell>
                  <TableCell className="text-sm">{tx.payee ?? ""}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{tx.notes ?? ""}</TableCell>
                  <TableCell
                    className={`text-right tabular-nums text-sm font-medium ${
                      tx.amount >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
                    }`}
                  >
                    {tx.amount >= 0 ? "+" : ""}
                    {tx.amount.toFixed(2)}
                  </TableCell>
                  <TableCell className="text-sm">{tx.categoryName ?? ""}</TableCell>
                  <TableCell className="text-right tabular-nums text-sm">
                    {tx.runningBalance.toFixed(2)}
                  </TableCell>
                  <TableCell className="text-sm">{tx.reference ?? ""}</TableCell>
                  <TableCell>{typeBadge(tx.type)}</TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          aria-label="Transaction actions"
                          data-testid={`tx-actions-${tx.id}`}
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEdit(tx)}>
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => setDeleteTarget(tx)}
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
        )}
      </div>

      {/* Transaction form */}
      <TransactionFormSheet
        open={formOpen}
        onOpenChange={setFormOpen}
        accountId={accountId}
        editTransaction={editTarget}
        onSaved={load}
      />

      {/* Delete confirmation */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete transaction?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the transaction
              {deleteTarget?.payee ? ` from ${deleteTarget.payee}` : ""}
              {" "}on {deleteTarget?.date}. Running balances will be recalculated.
              This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="delete-cancel">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="delete-confirm"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
