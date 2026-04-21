import { useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { reassignTransaction } from "@/lib/transactions";
import type { PotSummary } from "@/lib/pots";

interface Props {
  transactionId: number;
  currentPotId: number | null;
  accountId: number;
  accountName: string;
  pots: PotSummary[];
  onReassigned: () => void;
}

export function PotAssignmentSelect({
  transactionId,
  currentPotId,
  accountId,
  accountName,
  pots,
  onReassigned,
}: Props) {
  const [busy, setBusy] = useState(false);

  const value = currentPotId === null ? "account" : String(currentPotId);

  async function handleChange(next: string) {
    if (next === value || busy) return;
    setBusy(true);
    try {
      if (next === "account") {
        await reassignTransaction(transactionId, { accountId });
      } else {
        await reassignTransaction(transactionId, { potId: Number(next) });
      }
      onReassigned();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Select value={value} onValueChange={handleChange} disabled={busy}>
      <SelectTrigger
        className="h-7 w-36 text-xs"
        data-testid={`pot-assignment-${transactionId}`}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="account" data-testid={`pot-assignment-${transactionId}-account`}>
          {accountName}
        </SelectItem>
        {pots.map((p) => (
          <SelectItem
            key={p.id}
            value={String(p.id)}
            data-testid={`pot-assignment-${transactionId}-pot-${p.id}`}
          >
            {p.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
