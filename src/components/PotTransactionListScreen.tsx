import { ArrowLeft, ChevronDown, ChevronUp } from "lucide-react";
import { useEffect, useState } from "react";
import {
  listPotTransactions,
  type TransactionRow,
  type TransactionSort,
} from "@/lib/transactions";
import { getPotsForAccount, type PotSummary } from "@/lib/pots";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PotAssignmentSelect } from "./PotAssignmentSelect";

interface Props {
  potId: number;
  potName: string;
  accountId: number;
  accountName: string;
  onBack: () => void;
}

type SortCol = "date" | "amount";

export function PotTransactionListScreen({
  potId,
  potName,
  accountId,
  accountName,
  onBack,
}: Props) {
  const [transactions, setTransactions] = useState<TransactionRow[]>([]);
  const [pots, setPots] = useState<PotSummary[]>([]);
  const [loading, setLoading] = useState(true);

  const [sortCol, setSortCol] = useState<SortCol>("date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  useEffect(() => {
    loadPots();
  }, []);

  useEffect(() => {
    load();
  }, [potId, sortCol, sortDir]);

  async function loadPots() {
    setPots(await getPotsForAccount(accountId));
  }

  async function load() {
    setLoading(true);
    try {
      const sort: TransactionSort =
        sortCol === "date"
          ? sortDir === "desc" ? "date-desc" : "date-asc"
          : sortDir === "desc" ? "amount-desc" : "amount-asc";
      setTransactions(await listPotTransactions(potId, sort));
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

  return (
    <div className="flex h-screen flex-col">
      <header className="flex items-center gap-3 border-b px-6 py-3">
        <Button variant="ghost" size="icon" onClick={onBack} aria-label="Back">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <span className="font-semibold flex-1">{potName}</span>
      </header>

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
            No transactions yet.
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
                {pots.length > 0 && <TableHead data-testid="col-pot">Pot</TableHead>}
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
                  {pots.length > 0 && (
                    <TableCell>
                      {tx.type !== "virtual_transfer" && (
                        <PotAssignmentSelect
                          transactionId={tx.id}
                          currentPotId={tx.potId}
                          accountId={accountId}
                          accountName={accountName}
                          pots={pots}
                          onReassigned={load}
                        />
                      )}
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
