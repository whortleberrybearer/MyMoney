import { useEffect, useState } from "react";
import { AccountRow, listAccountsWithPots } from "@/lib/accounts";
import { TopBar } from "@/components/AppLayout";
import { Badge } from "@/components/ui/badge";

interface AccountsOverviewScreenProps {
  onNavigateToTransactions: (accountId: number, accountName: string) => void;
}

interface Category {
  id: string;
  label: string;
  color: string;
  typeNames: string[];
}

const CATEGORIES: Category[] = [
  { id: "current", label: "Current Accounts", color: "#4A9E8A", typeNames: ["Current", "Checking"] },
  { id: "savings", label: "Savings", color: "#6C5CE7", typeNames: ["Savings", "ISA", "Stocks & Shares ISA"] },
  { id: "pensions", label: "Pensions", color: "#2E8A5A", typeNames: ["Pension"] },
  { id: "mortgages", label: "Mortgages", color: "#C94040", typeNames: ["Mortgage"] },
  { id: "loans", label: "Loans", color: "#E8A020", typeNames: ["Loan", "Credit"] },
];

function getCategoryForType(typeName: string): Category {
  const lower = typeName.toLowerCase();
  return (
    CATEGORIES.find((c) =>
      c.typeNames.some((t) => t.toLowerCase() === lower),
    ) ?? { id: "other", label: "Other", color: "#8C8478", typeNames: [] }
  );
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

interface AccountCardProps {
  account: AccountRow;
  categoryColor: string;
  onClick: () => void;
}

function AccountCard({ account, categoryColor, onClick }: AccountCardProps) {
  const pots = account.pots ?? [];
  const hasPots = pots.length > 0;
  const potsTotal = hasPots
    ? pots.reduce((sum, p) => sum + p.currentBalance, 0)
    : 0;

  return (
    <button
      onClick={onClick}
      className="text-left w-full rounded overflow-hidden transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      style={{
        background: "var(--ds-surface)",
        border: "2px solid var(--ds-border)",
        borderTop: `3px solid ${categoryColor}`,
      }}
    >
      <div className="p-3.5">
        <div className="flex justify-between items-start mb-0.5">
          <span className="text-[16px] font-bold" style={{ color: "var(--ds-text)" }}>
            {account.name}
          </span>
          {account.tagName && (
            <Badge
              className="text-[11px] font-semibold ml-2 shrink-0"
              style={{
                background: `${categoryColor}18`,
                border: `1px solid ${categoryColor}40`,
                color: categoryColor,
              }}
            >
              {account.tagName}
            </Badge>
          )}
        </div>
        <div className="text-[12px] mb-2" style={{ color: "var(--ds-text-dim)" }}>
          {account.institutionName}
        </div>

        {hasPots ? (
          <>
            <div className="text-[12px] mb-1" style={{ color: "var(--ds-text-dim)" }}>
              Pots total
            </div>
            <div className="text-[22px] font-bold mb-2" style={{ color: "var(--ds-text)" }}>
              {formatCurrency(potsTotal)}
            </div>
          </>
        ) : (
          <>
            <div className="text-[24px] font-bold mb-0.5" style={{ color: "var(--ds-text)" }}>
              {formatCurrency(account.currentBalance)}
            </div>
          </>
        )}
      </div>

      {hasPots && (
        <div style={{ borderTop: "1px solid var(--ds-border)" }}>
          {pots.map((pot) => (
            <div
              key={pot.id}
              className="flex justify-between items-center px-3.5 py-1.5"
              style={{ borderBottom: "1px dashed var(--ds-border)" }}
            >
              <div className="flex items-center gap-1.5">
                <div
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ background: categoryColor }}
                />
                <span className="text-[13px]" style={{ color: "var(--ds-text)" }}>
                  {pot.name}
                </span>
              </div>
              <span className="text-[13px] font-semibold" style={{ color: "var(--ds-text)" }}>
                {formatCurrency(pot.currentBalance)}
              </span>
            </div>
          ))}
        </div>
      )}
    </button>
  );
}

export function AccountsOverviewScreen({ onNavigateToTransactions }: AccountsOverviewScreenProps) {
  const [accounts, setAccounts] = useState<AccountRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const rows = await listAccountsWithPots(false);
        if (!cancelled) setAccounts(rows);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const groupedAccounts = accounts.reduce<
    Map<string, { category: Category; accounts: AccountRow[] }>
  >((map, account) => {
    const category = getCategoryForType(account.accountTypeName);
    if (!map.has(category.id)) {
      map.set(category.id, { category, accounts: [] });
    }
    map.get(category.id)!.accounts.push(account);
    return map;
  }, new Map());

  const orderedGroups = [
    ...CATEGORIES.map((c) => groupedAccounts.get(c.id)).filter(Boolean),
    groupedAccounts.get("other"),
  ].filter(
    (g): g is { category: Category; accounts: AccountRow[] } =>
      g !== undefined && g.accounts.length > 0,
  );

  return (
    <div className="flex h-full flex-col" style={{ background: "var(--ds-bg)" }}>
      <TopBar title="Accounts" subtitle="All your financial accounts" />
      <div className="flex-1 overflow-y-auto p-[18px] flex flex-col gap-5">
        {loading && (
          <div className="text-[14px] mt-4" style={{ color: "var(--ds-text-dim)" }}>
            Loading accounts…
          </div>
        )}

        {!loading && orderedGroups.length === 0 && (
          <div className="text-[14px] mt-4" style={{ color: "var(--ds-text-dim)" }}>
            No accounts found. Add an account from the Dashboard.
          </div>
        )}

        {orderedGroups.map(({ category, accounts: catAccounts }) => (
          <div key={category.id}>
            <div className="flex items-center gap-2.5 mb-2.5">
              <div
                className="w-2.5 h-2.5 rounded-[2px] shrink-0"
                style={{ background: category.color }}
              />
              <span
                className="text-[13px] font-semibold uppercase tracking-[0.8px]"
                style={{ color: "var(--ds-text)" }}
              >
                {category.label}
              </span>
              <span className="text-[13px]" style={{ color: "var(--ds-text-dim)" }}>
                ({catAccounts.length})
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2.5 items-start">
              {catAccounts.map((account) => (
                <AccountCard
                  key={account.id}
                  account={account}
                  categoryColor={category.color}
                  onClick={() => onNavigateToTransactions(account.id, account.name)}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
