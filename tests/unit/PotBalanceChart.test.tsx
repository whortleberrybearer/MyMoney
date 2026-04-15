import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { PotBalanceChart } from "@/components/PotBalanceChart";
import type { PotRow } from "@/lib/pots";

// Recharts uses SVG and ResizeObserver which aren't available in jsdom.
// Mock the entire recharts module to render simple placeholder elements.
vi.mock("recharts", () => ({
  PieChart: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="pie-chart">{children}</div>
  ),
  Pie: ({ data }: { data: Array<{ name: string; value: number }> }) => (
    <div data-testid="pie">
      {data.map((d) => (
        <span key={d.name} data-testid={`slice-${d.name}`}>
          {d.name}:{d.value}
        </span>
      ))}
    </div>
  ),
  Cell: () => null,
  Tooltip: () => null,
  Legend: () => null,
}));

const ACTIVE_POT: PotRow = {
  id: 1,
  accountId: 1,
  name: "Holiday Fund",
  openingBalance: 0,
  openingDate: "2024-01-01",
  isActive: 1,
  notes: null,
  tagId: null,
  tagName: null,
  currentBalance: 300,
};

const CLOSED_POT: PotRow = {
  ...ACTIVE_POT,
  id: 2,
  name: "Old Pot",
  isActive: 0,
  currentBalance: 0,
};

describe("PotBalanceChart", () => {
  it("renders the chart", () => {
    render(
      <PotBalanceChart
        accountName="Current Account"
        accountOwnBalance={1000}
        currency="GBP"
        pots={[ACTIVE_POT]}
      />,
    );
    expect(screen.getByTestId("pie-chart")).toBeInTheDocument();
  });

  it("includes account own balance as a segment", () => {
    render(
      <PotBalanceChart
        accountName="Current Account"
        accountOwnBalance={1000}
        currency="GBP"
        pots={[ACTIVE_POT]}
      />,
    );
    expect(screen.getByTestId("slice-Current Account")).toBeInTheDocument();
  });

  it("includes active pot as a segment", () => {
    render(
      <PotBalanceChart
        accountName="Current Account"
        accountOwnBalance={1000}
        currency="GBP"
        pots={[ACTIVE_POT]}
      />,
    );
    expect(screen.getByTestId("slice-Holiday Fund")).toBeInTheDocument();
  });

  it("excludes closed pots from chart segments", () => {
    render(
      <PotBalanceChart
        accountName="Current Account"
        accountOwnBalance={1000}
        currency="GBP"
        pots={[ACTIVE_POT, CLOSED_POT]}
      />,
    );
    expect(screen.queryByTestId("slice-Old Pot")).not.toBeInTheDocument();
  });

  it("shows total combined balance", () => {
    render(
      <PotBalanceChart
        accountName="Current Account"
        accountOwnBalance={1000}
        currency="GBP"
        pots={[ACTIVE_POT]} // currentBalance=300
      />,
    );
    // Total = 1000 + 300 = 1300 → formatted as £1,300.00
    expect(screen.getByText(/1,300/)).toBeInTheDocument();
  });

  it("renders with no active pots (account-only breakdown)", () => {
    render(
      <PotBalanceChart
        accountName="Current Account"
        accountOwnBalance={500}
        currency="GBP"
        pots={[CLOSED_POT]}
      />,
    );
    expect(screen.getByTestId("slice-Current Account")).toBeInTheDocument();
    expect(screen.queryByTestId("slice-Old Pot")).not.toBeInTheDocument();
  });
});
