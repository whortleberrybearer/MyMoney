import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { PotTransferDialog } from "@/components/PotTransferDialog";
import * as transfersLib from "@/lib/transfers";
import type { AccountRow } from "@/lib/accounts";
import type { PotRow } from "@/lib/pots";

vi.mock("@/lib/transfers", () => ({
  createPotTransfer: vi.fn(),
}));

const mockCreateTransfer = vi.mocked(transfersLib.createPotTransfer);

const ACCOUNT: AccountRow = {
  id: 1,
  name: "Barclays Current",
  institutionId: 1,
  institutionName: "Barclays",
  accountTypeId: 1,
  accountTypeName: "Current",
  currency: "GBP",
  openingBalance: 1000,
  openingDate: "2024-01-01",
  notes: null,
  isActive: 1,
  tagId: null,
  tagName: null,
};

const POT: PotRow = {
  id: 5,
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

function renderDialog(props: Partial<Parameters<typeof PotTransferDialog>[0]> = {}) {
  const defaults = {
    open: true,
    onOpenChange: vi.fn(),
    pot: POT,
    account: ACCOUNT,
    onTransferred: vi.fn(),
  };
  render(<PotTransferDialog {...defaults} {...props} />);
  return defaults;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockCreateTransfer.mockResolvedValue(undefined);
});

describe("PotTransferDialog", () => {
  it("shows pot and account names", async () => {
    renderDialog();
    await waitFor(() => {
      expect(screen.getByText("Holiday Fund")).toBeInTheDocument();
      expect(screen.getByText("Barclays Current")).toBeInTheDocument();
    });
  });

  it("defaults direction to 'Into pot'", async () => {
    renderDialog();
    await waitFor(() => {
      const intoRadio = screen.getByRole("radio", { name: /into pot/i });
      expect(intoRadio).toBeChecked();
    });
  });

  it("shows validation errors when submitting empty form", async () => {
    renderDialog();
    await waitFor(() => screen.getByRole("button", { name: /transfer/i }));

    fireEvent.click(screen.getByRole("button", { name: /transfer/i }));

    await waitFor(() => {
      expect(
        screen.getByText("Amount must be greater than zero"),
      ).toBeInTheDocument();
      expect(screen.getByText("Date is required")).toBeInTheDocument();
    });
    expect(mockCreateTransfer).not.toHaveBeenCalled();
  });

  it("shows validation error for zero amount", async () => {
    renderDialog();
    await waitFor(() => screen.getByLabelText(/amount \*/i));

    fireEvent.change(screen.getByLabelText(/amount \*/i), {
      target: { value: "0" },
    });
    fireEvent.change(screen.getByLabelText(/date \*/i), {
      target: { value: "2024-02-01" },
    });
    fireEvent.click(screen.getByRole("button", { name: /transfer/i }));

    await waitFor(() => {
      expect(
        screen.getByText("Amount must be greater than zero"),
      ).toBeInTheDocument();
    });
  });

  it("calls createPotTransfer with correct payload (into pot)", async () => {
    renderDialog();
    await waitFor(() => screen.getByLabelText(/amount \*/i));

    fireEvent.change(screen.getByLabelText(/amount \*/i), {
      target: { value: "100" },
    });
    fireEvent.change(screen.getByLabelText(/date \*/i), {
      target: { value: "2024-02-01" },
    });
    fireEvent.change(screen.getByLabelText(/^notes$/i), {
      target: { value: "Monthly saving" },
    });
    fireEvent.click(screen.getByRole("button", { name: /transfer/i }));

    await waitFor(() => {
      expect(mockCreateTransfer).toHaveBeenCalledWith({
        potId: 5,
        accountId: 1,
        amount: 100,
        date: "2024-02-01",
        direction: "into_pot",
        notes: "Monthly saving",
      });
    });
  });

  it("calls createPotTransfer with direction out_of_pot when selected", async () => {
    renderDialog();
    await waitFor(() => screen.getByLabelText(/amount \*/i));

    fireEvent.click(screen.getByRole("radio", { name: /out of pot/i }));
    fireEvent.change(screen.getByLabelText(/amount \*/i), {
      target: { value: "50" },
    });
    fireEvent.change(screen.getByLabelText(/date \*/i), {
      target: { value: "2024-02-01" },
    });
    fireEvent.click(screen.getByRole("button", { name: /transfer/i }));

    await waitFor(() => {
      expect(mockCreateTransfer).toHaveBeenCalledWith(
        expect.objectContaining({ direction: "out_of_pot", amount: 50 }),
      );
    });
  });

  it("calls onTransferred and closes dialog on success", async () => {
    const onTransferred = vi.fn();
    const onOpenChange = vi.fn();
    renderDialog({ onTransferred, onOpenChange });
    await waitFor(() => screen.getByLabelText(/amount \*/i));

    fireEvent.change(screen.getByLabelText(/amount \*/i), {
      target: { value: "75" },
    });
    fireEvent.change(screen.getByLabelText(/date \*/i), {
      target: { value: "2024-02-01" },
    });
    fireEvent.click(screen.getByRole("button", { name: /transfer/i }));

    await waitFor(() => {
      expect(onTransferred).toHaveBeenCalled();
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });

  it("shows error message when createPotTransfer throws", async () => {
    mockCreateTransfer.mockRejectedValueOnce(
      new Error("Transfer amount must be greater than zero"),
    );
    renderDialog();
    await waitFor(() => screen.getByLabelText(/amount \*/i));

    fireEvent.change(screen.getByLabelText(/amount \*/i), {
      target: { value: "100" },
    });
    fireEvent.change(screen.getByLabelText(/date \*/i), {
      target: { value: "2024-02-01" },
    });
    fireEvent.click(screen.getByRole("button", { name: /transfer/i }));

    await waitFor(() => {
      expect(
        screen.getByText("Transfer amount must be greater than zero"),
      ).toBeInTheDocument();
    });
  });
});
