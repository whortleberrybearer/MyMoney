import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { TransactionFormSheet } from "@/components/TransactionFormSheet";
import * as transactionsLib from "@/lib/transactions";
import * as referenceData from "@/lib/reference-data";
import type { TransactionRow } from "@/lib/transactions";

vi.mock("@/lib/transactions", () => ({
  createTransaction: vi.fn(),
  updateTransaction: vi.fn(),
  listTransactions: vi.fn(),
  deleteTransaction: vi.fn(),
  recalculateRunningBalance: vi.fn(),
}));

vi.mock("@/lib/reference-data", () => ({
  listCategories: vi.fn().mockResolvedValue([]),
  listTags: vi.fn().mockResolvedValue([]),
}));

const BASE_TX: TransactionRow = {
  id: 1,
  accountId: 10,
  potId: null,
  transferId: null,
  date: "2024-01-15",
  payee: "Tesco",
  notes: "Groceries",
  reference: "REF001",
  amount: -25.0,
  categoryId: null,
  categoryName: null,
  runningBalance: 75.0,
  type: "manual",
  isVoid: 0,
};

const IMPORTED_TX: TransactionRow = {
  ...BASE_TX,
  id: 2,
  type: "imported",
};

beforeEach(() => {
  vi.mocked(referenceData.listCategories).mockResolvedValue([]);
  vi.mocked(transactionsLib.createTransaction).mockResolvedValue(undefined);
  vi.mocked(transactionsLib.updateTransaction).mockResolvedValue(undefined);
});

describe("TransactionFormSheet — create mode", () => {
  it("shows all fields as editable in create mode", async () => {
    render(
      <TransactionFormSheet
        open={true}
        onOpenChange={vi.fn()}
        accountId={10}
        onSaved={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId("tx-date")).toBeInTheDocument();
    });

    const dateField = screen.getByTestId("tx-date") as HTMLInputElement;
    const amountField = screen.getByTestId("tx-amount") as HTMLInputElement;

    expect(dateField.readOnly).toBe(false);
    expect(amountField.readOnly).toBe(false);
  });

  it("blocks submit when date is missing", async () => {
    const onSaved = vi.fn();
    render(
      <TransactionFormSheet
        open={true}
        onOpenChange={vi.fn()}
        accountId={10}
        onSaved={onSaved}
      />,
    );

    await waitFor(() => screen.getByTestId("tx-date"));

    // Clear the date field
    fireEvent.change(screen.getByTestId("tx-date"), { target: { value: "" } });
    // Set a valid amount
    fireEvent.change(screen.getByTestId("tx-amount"), { target: { value: "-10" } });

    fireEvent.click(screen.getByTestId("tx-save"));

    await waitFor(() => {
      expect(screen.getByText(/date is required/i)).toBeInTheDocument();
    });
    expect(onSaved).not.toHaveBeenCalled();
  });

  it("blocks submit when amount is missing", async () => {
    const onSaved = vi.fn();
    render(
      <TransactionFormSheet
        open={true}
        onOpenChange={vi.fn()}
        accountId={10}
        onSaved={onSaved}
      />,
    );

    await waitFor(() => screen.getByTestId("tx-amount"));

    // Leave amount empty
    fireEvent.click(screen.getByTestId("tx-save"));

    await waitFor(() => {
      expect(screen.getByText(/valid amount/i)).toBeInTheDocument();
    });
    expect(onSaved).not.toHaveBeenCalled();
  });
});

describe("TransactionFormSheet — edit mode, imported transaction", () => {
  it("shows date and amount as read-only for imported transactions", async () => {
    render(
      <TransactionFormSheet
        open={true}
        onOpenChange={vi.fn()}
        accountId={10}
        editTransaction={IMPORTED_TX}
        onSaved={vi.fn()}
      />,
    );

    await waitFor(() => screen.getByTestId("tx-date"));

    const dateField = screen.getByTestId("tx-date") as HTMLInputElement;
    const amountField = screen.getByTestId("tx-amount") as HTMLInputElement;

    expect(dateField.readOnly).toBe(true);
    expect(amountField.readOnly).toBe(true);
  });

  it("shows payee and notes as editable for imported transactions", async () => {
    render(
      <TransactionFormSheet
        open={true}
        onOpenChange={vi.fn()}
        accountId={10}
        editTransaction={IMPORTED_TX}
        onSaved={vi.fn()}
      />,
    );

    await waitFor(() => screen.getByTestId("tx-payee"));

    const payeeField = screen.getByTestId("tx-payee") as HTMLInputElement;
    const notesField = screen.getByTestId("tx-notes") as HTMLInputElement;

    expect(payeeField.readOnly).toBe(false);
    expect(notesField.readOnly).toBe(false);
  });
});

describe("TransactionFormSheet — edit mode, manual transaction", () => {
  it("shows date and amount as editable for manual transactions", async () => {
    render(
      <TransactionFormSheet
        open={true}
        onOpenChange={vi.fn()}
        accountId={10}
        editTransaction={BASE_TX}
        onSaved={vi.fn()}
      />,
    );

    await waitFor(() => screen.getByTestId("tx-date"));

    const dateField = screen.getByTestId("tx-date") as HTMLInputElement;
    const amountField = screen.getByTestId("tx-amount") as HTMLInputElement;

    expect(dateField.readOnly).toBe(false);
    expect(amountField.readOnly).toBe(false);
  });
});
