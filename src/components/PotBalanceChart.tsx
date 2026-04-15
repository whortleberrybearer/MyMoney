import { Cell, Legend, Pie, PieChart, Tooltip } from "recharts";
import type { PotRow } from "@/lib/pots";

interface Props {
  accountName: string;
  accountOwnBalance: number;
  currency: string;
  pots: PotRow[];
}

// Palette of accessible chart colours
const COLOURS = [
  "#6366f1", // indigo
  "#22d3ee", // cyan
  "#f59e0b", // amber
  "#10b981", // emerald
  "#f43f5e", // rose
  "#8b5cf6", // violet
  "#3b82f6", // blue
  "#84cc16", // lime
];

function formatAmount(value: number, currency: string): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(value);
}

export function PotBalanceChart({
  accountName,
  accountOwnBalance,
  currency,
  pots,
}: Props) {
  // Only include active pots in the chart
  const activePots = pots.filter((p) => p.isActive === 1);

  const data = [
    {
      name: accountName,
      value: Math.max(0, accountOwnBalance),
      label: formatAmount(accountOwnBalance, currency),
    },
    ...activePots.map((p) => ({
      name: p.name,
      value: Math.max(0, p.currentBalance),
      label: formatAmount(p.currentBalance, currency),
    })),
  ];

  const total =
    accountOwnBalance + activePots.reduce((s, p) => s + p.currentBalance, 0);

  return (
    <div className="flex flex-col items-center gap-2 py-4">
      <PieChart width={320} height={200}>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={50}
          outerRadius={80}
          paddingAngle={2}
          dataKey="value"
        >
          {data.map((_, index) => (
            <Cell key={index} fill={COLOURS[index % COLOURS.length]} />
          ))}
        </Pie>
        <Tooltip
          formatter={(value) => {
            const asNumber =
              typeof value === "number" ? value : Number(value ?? 0);
            return formatAmount(
              Number.isFinite(asNumber) ? asNumber : 0,
              currency,
            );
          }}
        />
        <Legend
          formatter={(value: string) => (
            <span className="text-xs">{value}</span>
          )}
        />
      </PieChart>
      <p className="text-sm text-muted-foreground">
        Total: {formatAmount(total, currency)}
      </p>
    </div>
  );
}
