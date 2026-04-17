import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { TransactionFormSheet } from "@/components/TransactionFormSheet";
import * as transactionsLib from "@/lib/transactions";
import * as categoriesLib from "@/lib/categories";
import type { TransactionRow } from "@/lib/transactions";

vi.mock("@/lib/transactions", () => ({
  createTransaction: vi.fn(),
  updateTransaction: vi.fn(),
  listTransactions: vi.fn(),
  deleteTransaction: vi.fn(),
  recalculateRunningBalance: vi.fn(),
}));

vi.mock("@/lib/categories", () => ({
  listCategories: vi.fn().mockResolvedValue([]),
}));

const CATEGORIES: categoriesLib.Category[] = [
  { id: 1, name: "Bills", isSystem: 0, sortOrder: 3 },
  { id: 2, name: "Groceries", isSystem: 0, sortOrder: 4 },
  { id: 999, name: "Uncategorised", isSystem: 1, sortOrder: 999 },
];

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
  vi.mocked(categoriesLib.listCategories).mockResolvedValue([]);
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

describe("TransactionFormSheet — category combobox", () => {
  it("renders the category combobox", async () => {
    render(
      <TransactionFormSheet
        open={true}
        onOpenChange={vi.fn()}
        accountId={10}
        onSaved={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId("tx-category")).toBeInTheDocument();
    });
  });

  it("shows 'Uncategorised' in the combobox by default when creating a transaction", async () => {
    vi.mocked(categoriesLib.listCategories).mockResolvedValue(CATEGORIES);
    render(
      <TransactionFormSheet
        open={true}
        onOpenChange={vi.fn()}
        accountId={10}
        onSaved={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId("tx-category")).toHaveTextContent("Uncategorised");
    });
  });

  it("pre-populates category when editing a transaction with a category", async () => {
    vi.mocked(categoriesLib.listCategories).mockResolvedValue(CATEGORIES);
    const txWithCategory: TransactionRow = {
      ...BASE_TX,
      categoryId: 2,
      categoryName: "Groceries",
    };

    render(
      <TransactionFormSheet
        open={true}
        onOpenChange={vi.fn()}
        accountId={10}
        editTransaction={txWithCategory}
        onSaved={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId("tx-category")).toHaveTextContent("Groceries");
    });
  });

  it("passes null category_id to createTransaction when Uncategorised is selected", async () => {
    vi.mocked(categoriesLib.listCategories).mockResolvedValue(CATEGORIES);
    const mockCreate = vi.mocked(transactionsLib.createTransaction);

    render(
      <TransactionFormSheet
        open={true}
        onOpenChange={vi.fn()}
        accountId={10}
        onSaved={vi.fn()}
      />,
    );

    await waitFor(() => screen.getByTestId("tx-date"));

    fireEvent.change(screen.getByTestId("tx-date"), { target: { value: "2024-03-01" } });
    fireEvent.change(screen.getByTestId("tx-amount"), { target: { value: "-10" } });
    fireEvent.click(screen.getByTestId("tx-save"));

    await waitFor(() => {
      expect(mockCreate).toHaveBeenCalledWith(
        10,
        expect.objectContaining({ categoryId: undefined }),
      );
    });
  });

  it("passes the category id to updateTransaction when editing", async () => {
    vi.mocked(categoriesLib.listCategories).mockResolvedValue(CATEGORIES);
    const mockUpdate = vi.mocked(transactionsLib.updateTransaction);
    const txWithCategory: TransactionRow = {
      ...BASE_TX,
      categoryId: 1,
      categoryName: "Bills",
    };

    render(
      <TransactionFormSheet
        open={true}
        onOpenChange={vi.fn()}
        accountId={10}
        editTransaction={txWithCategory}
        onSaved={vi.fn()}
      />,
    );

    await waitFor(() => screen.getByTestId("tx-save"));
    fireEvent.click(screen.getByTestId("tx-save"));

    await waitFor(() => {
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ categoryId: 1 }),
      );
    });
  });
});
