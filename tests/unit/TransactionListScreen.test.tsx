import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { TransactionListScreen } from "@/components/TransactionListScreen";
import * as transactionsLib from "@/lib/transactions";
import * as referenceData from "@/lib/reference-data";
import * as potsLib from "@/lib/pots";

vi.mock("@/lib/transactions", () => ({
  listTransactions: vi.fn(),
  deleteTransaction: vi.fn(),
  createTransaction: vi.fn(),
  updateTransaction: vi.fn(),
  recalculateRunningBalance: vi.fn(),
  reassignTransaction: vi.fn(),
}));

vi.mock("@/lib/reference-data", () => ({
  listCategories: vi.fn().mockResolvedValue([]),
  listTags: vi.fn().mockResolvedValue([]),
}));

vi.mock("@/lib/pots", () => ({
  getPotsForAccount: vi.fn().mockResolvedValue([]),
}));

const mockListTransactions = vi.mocked(transactionsLib.listTransactions);
const mockGetPotsForAccount = vi.mocked(potsLib.getPotsForAccount);

const BASE_TX: transactionsLib.TransactionRow = {
  id: 1,
  accountId: 10,
  potId: null,
  transferId: null,
  date: "2024-01-15",
  payee: "Starbucks",
  notes: "Coffee",
  reference: null,
  amount: -3.5,
  categoryId: null,
  categoryName: null,
  runningBalance: 96.5,
  type: "manual",
  isVoid: 0,
};

beforeEach(() => {
  mockListTransactions.mockResolvedValue([]);
  vi.mocked(referenceData.listCategories).mockResolvedValue([]);
  mockGetPotsForAccount.mockResolvedValue([]);
});

describe("TransactionListScreen — empty state", () => {
  it("renders empty state when there are no transactions", async () => {
    mockListTransactions.mockResolvedValue([]);

    render(
      <TransactionListScreen
        accountId={10}
        accountName="My Account"
        onBack={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId("empty-state")).toBeInTheDocument();
    });
    expect(screen.getByTestId("empty-state").textContent).toMatch(/no transactions/i);
  });

  it("shows the account name in the header", async () => {
    render(
      <TransactionListScreen
        accountId={10}
        accountName="Current Account"
        onBack={vi.fn()}
      />,
    );

    expect(screen.getByText("Current Account")).toBeInTheDocument();
  });

  it("shows the Add Transaction button when empty", async () => {
    render(
      <TransactionListScreen
        accountId={10}
        accountName="Test"
        onBack={vi.fn()}
      />,
    );

    expect(screen.getByTestId("add-transaction-btn")).toBeInTheDocument();
  });

  it("calls onBack when the back button is clicked", async () => {
    const onBack = vi.fn();
    render(
      <TransactionListScreen accountId={10} accountName="Test" onBack={onBack} />,
    );
    screen.getByRole("button", { name: /back/i }).click();
    expect(onBack).toHaveBeenCalled();
  });
});

describe("TransactionListScreen — transaction rows", () => {
  it("renders transaction rows with correct columns", async () => {
    mockListTransactions.mockResolvedValue([BASE_TX]);

    render(
      <TransactionListScreen accountId={10} accountName="Test" onBack={vi.fn()} />,
    );

    await waitFor(() => {
      expect(screen.getByTestId(`tx-row-${BASE_TX.id}`)).toBeInTheDocument();
    });

    const row = screen.getByTestId(`tx-row-${BASE_TX.id}`);
    expect(row.textContent).toContain("2024-01-15");
    expect(row.textContent).toContain("Starbucks");
    expect(row.textContent).toContain("Coffee");
    expect(row.textContent).toContain("-3.50");
    expect(row.textContent).toContain("96.50");
  });

  it("renders virtual transfer rows with italic styling", async () => {
    const transferTx: transactionsLib.TransactionRow = {
      ...BASE_TX,
      id: 2,
      type: "virtual_transfer",
    };
    mockListTransactions.mockResolvedValue([transferTx]);

    render(
      <TransactionListScreen accountId={10} accountName="Test" onBack={vi.fn()} />,
    );

    await waitFor(() => {
      expect(screen.getByTestId(`tx-row-${transferTx.id}`)).toBeInTheDocument();
    });

    const row = screen.getByTestId(`tx-row-${transferTx.id}`);
    expect(row.className).toContain("italic");
  });

  it("renders imported rows without italic styling", async () => {
    const importedTx: transactionsLib.TransactionRow = {
      ...BASE_TX,
      id: 3,
      type: "imported",
    };
    mockListTransactions.mockResolvedValue([importedTx]);

    render(
      <TransactionListScreen accountId={10} accountName="Test" onBack={vi.fn()} />,
    );

    await waitFor(() => {
      expect(screen.getByTestId(`tx-row-${importedTx.id}`)).toBeInTheDocument();
    });

    const row = screen.getByTestId(`tx-row-${importedTx.id}`);
    expect(row.className).not.toContain("italic");
  });
});

describe("TransactionListScreen — Pot column", () => {
  it("shows Pot column when account has active pots", async () => {
    mockGetPotsForAccount.mockResolvedValue([
      { id: 10, name: "Holiday Fund" },
    ]);
    mockListTransactions.mockResolvedValue([BASE_TX]);

    render(
      <TransactionListScreen accountId={10} accountName="My Account" onBack={vi.fn()} />,
    );

    await waitFor(() => {
      expect(screen.getByTestId("col-pot")).toBeInTheDocument();
    });
  });

  it("hides Pot column when account has no active pots", async () => {
    mockGetPotsForAccount.mockResolvedValue([]);
    mockListTransactions.mockResolvedValue([BASE_TX]);

    render(
      <TransactionListScreen accountId={10} accountName="My Account" onBack={vi.fn()} />,
    );

    await waitFor(() => {
      expect(screen.getByTestId(`tx-row-${BASE_TX.id}`)).toBeInTheDocument();
    });
    expect(screen.queryByTestId("col-pot")).not.toBeInTheDocument();
  });

  it("does not render PotAssignmentSelect on virtual transfer rows", async () => {
    mockGetPotsForAccount.mockResolvedValue([
      { id: 10, name: "Holiday Fund" },
    ]);
    const transferTx: transactionsLib.TransactionRow = {
      ...BASE_TX,
      id: 5,
      type: "virtual_transfer",
    };
    mockListTransactions.mockResolvedValue([transferTx]);

    render(
      <TransactionListScreen accountId={10} accountName="My Account" onBack={vi.fn()} />,
    );

    await waitFor(() => {
      expect(screen.getByTestId(`tx-row-${transferTx.id}`)).toBeInTheDocument();
    });
    expect(screen.queryByTestId(`pot-assignment-${transferTx.id}`)).not.toBeInTheDocument();
  });
});
