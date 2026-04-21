import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { PotAssignmentSelect } from "@/components/PotAssignmentSelect";
import * as txLib from "@/lib/transactions";

vi.mock("@/lib/transactions", () => ({
  reassignTransaction: vi.fn(),
}));

const mockReassign = vi.mocked(txLib.reassignTransaction);

const POTS = [
  { id: 10, name: "Holiday Fund" },
  { id: 11, name: "Emergency" },
];

function renderSelect(props: Partial<Parameters<typeof PotAssignmentSelect>[0]> = {}) {
  const defaults = {
    transactionId: 42,
    currentPotId: null,
    accountId: 1,
    accountName: "Main Account",
    pots: POTS,
    onReassigned: vi.fn(),
  };
  return render(<PotAssignmentSelect {...defaults} {...props} />);
}

beforeEach(() => {
  vi.clearAllMocks();
  mockReassign.mockResolvedValue(undefined);
});

describe("PotAssignmentSelect", () => {
  it("renders the account option and pot options when opened", async () => {
    renderSelect();
    fireEvent.click(screen.getByTestId("pot-assignment-42"));
    expect(screen.getByTestId("pot-assignment-42-account")).toBeInTheDocument();
    expect(screen.getByTestId("pot-assignment-42-pot-10")).toBeInTheDocument();
    expect(screen.getByTestId("pot-assignment-42-pot-11")).toBeInTheDocument();
  });

  it("shows the account as selected when currentPotId is null", () => {
    renderSelect({ currentPotId: null });
    expect(screen.getByTestId("pot-assignment-42")).toHaveTextContent("Main Account");
  });

  it("shows the pot name as selected when currentPotId is set", () => {
    renderSelect({ currentPotId: 10 });
    expect(screen.getByTestId("pot-assignment-42")).toHaveTextContent("Holiday Fund");
  });

  it("calls reassignTransaction with potId when a pot is selected", async () => {
    const onReassigned = vi.fn();
    renderSelect({ currentPotId: null, onReassigned });

    fireEvent.click(screen.getByTestId("pot-assignment-42"));
    fireEvent.click(screen.getByTestId("pot-assignment-42-pot-10"));

    await waitFor(() => {
      expect(mockReassign).toHaveBeenCalledWith(42, { potId: 10 });
      expect(onReassigned).toHaveBeenCalled();
    });
  });

  it("calls reassignTransaction with accountId when account is selected from a pot", async () => {
    const onReassigned = vi.fn();
    renderSelect({ currentPotId: 10, onReassigned });

    fireEvent.click(screen.getByTestId("pot-assignment-42"));
    fireEvent.click(screen.getByTestId("pot-assignment-42-account"));

    await waitFor(() => {
      expect(mockReassign).toHaveBeenCalledWith(42, { accountId: 1 });
      expect(onReassigned).toHaveBeenCalled();
    });
  });
});
