import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { PotAllocationRulesTab } from "@/components/PotAllocationRulesTab";
import * as parLib from "@/lib/pot-allocation-rules";
import * as potsLib from "@/lib/pots";
import type { PotAllocationRule } from "@/lib/pot-allocation-rules";
import type { PotRow } from "@/lib/pots";

vi.mock("@/lib/pot-allocation-rules", () => ({
  getPotAllocationRules: vi.fn(),
  togglePotAllocationRuleActive: vi.fn(),
  deletePotAllocationRule: vi.fn(),
  reorderPotAllocationRules: vi.fn(),
  createPotAllocationRule: vi.fn(),
  updatePotAllocationRule: vi.fn(),
}));

vi.mock("@/lib/pots", () => ({
  listPots: vi.fn(),
}));

const mockGetRules = vi.mocked(parLib.getPotAllocationRules);
const mockToggle = vi.mocked(parLib.togglePotAllocationRuleActive);
const mockDelete = vi.mocked(parLib.deletePotAllocationRule);
const mockListPots = vi.mocked(potsLib.listPots);

const ACCOUNT_ID = 1;

const POTS: PotRow[] = [
  { id: 10, accountId: ACCOUNT_ID, name: "Holiday Pot", openingBalance: 0, openingDate: "2024-01-01", isActive: 1, notes: null, tagId: null, tagName: null, currentBalance: 0 },
];

const RULE_A: PotAllocationRule = {
  id: 1,
  accountId: ACCOUNT_ID,
  name: "Salary split",
  priority: 1,
  isActive: 1,
  conditions: [{ id: 1, field: "description", operator: "contains", value: "SALARY" }],
  actions: [{ id: 1, potId: 10, allocationValue: 200 }],
};

const RULE_B: PotAllocationRule = {
  id: 2,
  accountId: ACCOUNT_ID,
  name: "Bonus",
  priority: 2,
  isActive: 0,
  conditions: [{ id: 2, field: "amount", operator: "greater_than", value: "1000" }],
  actions: [{ id: 2, potId: 10, allocationValue: 100 }],
};

function renderTab() {
  render(<PotAllocationRulesTab accountId={ACCOUNT_ID} />);
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetRules.mockResolvedValue([RULE_A, RULE_B]);
  mockToggle.mockResolvedValue(undefined);
  mockDelete.mockResolvedValue(undefined);
  mockListPots.mockResolvedValue(POTS);
});

describe("PotAllocationRulesTab — rendering", () => {
  it("renders rules in priority order", async () => {
    renderTab();
    await waitFor(() => {
      expect(screen.getByText("Salary split")).toBeInTheDocument();
      expect(screen.getByText("Bonus")).toBeInTheDocument();
    });
    const rows = screen.getAllByTestId(/^par-rule-row-/);
    expect(rows[0]).toHaveTextContent("Salary split");
    expect(rows[1]).toHaveTextContent("Bonus");
  });

  it("shows empty state when no rules exist", async () => {
    mockGetRules.mockResolvedValue([]);
    renderTab();
    await waitFor(() => {
      expect(screen.getByTestId("par-empty-state")).toBeInTheDocument();
    });
  });

  it("shows + New Rule button", async () => {
    renderTab();
    await waitFor(() => {
      expect(screen.getByTestId("par-new-rule-button")).toBeInTheDocument();
    });
  });
});

describe("PotAllocationRulesTab — toggle", () => {
  it("calls togglePotAllocationRuleActive when toggle is clicked", async () => {
    mockToggle.mockResolvedValue(undefined);
    mockGetRules
      .mockResolvedValueOnce([RULE_A, RULE_B])
      .mockResolvedValue([{ ...RULE_A, isActive: 0 }, RULE_B]);

    renderTab();
    await waitFor(() => screen.getByTestId(`par-rule-toggle-${RULE_A.id}`));

    fireEvent.click(screen.getByTestId(`par-rule-toggle-${RULE_A.id}`));

    await waitFor(() => {
      expect(mockToggle).toHaveBeenCalledWith(RULE_A.id);
    });
  });
});

describe("PotAllocationRulesTab — delete confirmation", () => {
  it("shows confirmation dialog when delete is clicked", async () => {
    renderTab();
    await waitFor(() => screen.getByTestId(`par-rule-delete-${RULE_A.id}`));

    fireEvent.click(screen.getByTestId(`par-rule-delete-${RULE_A.id}`));

    await waitFor(() => {
      expect(screen.getByTestId("par-delete-confirm")).toBeInTheDocument();
    });
  });

  it("calls deletePotAllocationRule on confirm", async () => {
    mockDelete.mockResolvedValue(undefined);
    mockGetRules
      .mockResolvedValueOnce([RULE_A, RULE_B])
      .mockResolvedValue([RULE_B]);

    renderTab();
    await waitFor(() => screen.getByTestId(`par-rule-delete-${RULE_A.id}`));

    fireEvent.click(screen.getByTestId(`par-rule-delete-${RULE_A.id}`));
    await waitFor(() => screen.getByTestId("par-delete-confirm"));
    fireEvent.click(screen.getByTestId("par-delete-confirm"));

    await waitFor(() => {
      expect(mockDelete).toHaveBeenCalledWith(RULE_A.id);
    });
  });

  it("does not delete when cancel is clicked", async () => {
    renderTab();
    await waitFor(() => screen.getByTestId(`par-rule-delete-${RULE_A.id}`));

    fireEvent.click(screen.getByTestId(`par-rule-delete-${RULE_A.id}`));
    await waitFor(() => screen.getByTestId("par-delete-cancel"));
    fireEvent.click(screen.getByTestId("par-delete-cancel"));

    await waitFor(() => {
      expect(mockDelete).not.toHaveBeenCalled();
    });
  });
});
