import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { RulesManagementScreen } from "@/components/RulesManagementScreen";
import * as rulesLib from "@/lib/rules";
import * as categoriesLib from "@/lib/categories";
import type { Rule } from "@/lib/rules";
import type { Category } from "@/lib/categories";

vi.mock("@/lib/rules", () => ({
  getRules: vi.fn(),
  toggleRuleActive: vi.fn(),
  deleteRule: vi.fn(),
  reorderRules: vi.fn(),
  applyRules: vi.fn(),
  createRule: vi.fn(),
  updateRule: vi.fn(),
}));

vi.mock("@/lib/categories", () => ({
  listCategories: vi.fn(),
}));

const mockGetRules = vi.mocked(rulesLib.getRules);
const mockToggle = vi.mocked(rulesLib.toggleRuleActive);
const mockDelete = vi.mocked(rulesLib.deleteRule);
const mockApplyRules = vi.mocked(rulesLib.applyRules);
const mockListCategories = vi.mocked(categoriesLib.listCategories);

const CATEGORIES: Category[] = [
  { id: 1, name: "Groceries", isSystem: 0, sortOrder: 4 },
  { id: 999, name: "Uncategorised", isSystem: 1, sortOrder: 999 },
];

const RULE_A: Rule = {
  id: 1,
  name: "Starbucks Rule",
  sortOrder: 1,
  isActive: 1,
  conditions: [{ id: 1, field: "description", operator: "contains", value: "starbucks" }],
  actions: [{ id: 1, actionType: "assign_category", categoryId: 1 }],
};

const RULE_B: Rule = {
  id: 2,
  name: "Amazon Rule",
  sortOrder: 2,
  isActive: 0,
  conditions: [],
  actions: [],
};

function renderScreen() {
  render(<RulesManagementScreen onBack={vi.fn()} />);
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetRules.mockResolvedValue([RULE_A, RULE_B]);
  mockToggle.mockResolvedValue(undefined);
  mockDelete.mockResolvedValue(undefined);
  mockApplyRules.mockResolvedValue(5);
  mockListCategories.mockResolvedValue(CATEGORIES);
});

describe("RulesManagementScreen — rendering", () => {
  it("renders rules in priority order", async () => {
    renderScreen();
    await waitFor(() => {
      expect(screen.getByText("Starbucks Rule")).toBeInTheDocument();
      expect(screen.getByText("Amazon Rule")).toBeInTheDocument();
    });
  });

  it("shows empty state when no rules exist", async () => {
    mockGetRules.mockResolvedValue([]);
    renderScreen();
    await waitFor(() => {
      expect(screen.getByTestId("rules-empty-state")).toBeInTheDocument();
    });
  });

  it("shows Active label for active rule", async () => {
    renderScreen();
    await waitFor(() => {
      expect(screen.getByTestId("rule-row-1")).toBeInTheDocument();
    });
    expect(screen.getAllByText("Active")).toHaveLength(1);
    expect(screen.getAllByText("Off")).toHaveLength(1);
  });
});

describe("RulesManagementScreen — toggle", () => {
  it("calls toggleRuleActive and reloads on toggle", async () => {
    renderScreen();
    await waitFor(() => screen.getByTestId("rule-toggle-1"));
    fireEvent.click(screen.getByTestId("rule-toggle-1"));
    await waitFor(() => expect(mockToggle).toHaveBeenCalledWith(1));
    expect(mockGetRules).toHaveBeenCalledTimes(2); // initial + reload
  });
});

describe("RulesManagementScreen — delete", () => {
  it("shows confirmation dialog before deleting", async () => {
    renderScreen();
    await waitFor(() => screen.getByTestId("rule-delete-1"));
    fireEvent.click(screen.getByTestId("rule-delete-1"));
    await waitFor(() => {
      expect(screen.getByText(/permanently deleted/i)).toBeInTheDocument();
    });
    expect(mockDelete).not.toHaveBeenCalled();
  });

  it("deletes rule on confirmation", async () => {
    renderScreen();
    await waitFor(() => screen.getByTestId("rule-delete-1"));
    fireEvent.click(screen.getByTestId("rule-delete-1"));
    await waitFor(() => screen.getByTestId("delete-confirm-button"));
    fireEvent.click(screen.getByTestId("delete-confirm-button"));
    await waitFor(() => expect(mockDelete).toHaveBeenCalledWith(1));
  });
});

describe("RulesManagementScreen — re-run", () => {
  it("shows confirmation dialog before re-running", async () => {
    renderScreen();
    await waitFor(() => screen.getByTestId("rerun-button"));
    fireEvent.click(screen.getByTestId("rerun-button"));
    await waitFor(() => {
      expect(screen.getByText(/overwrite/i)).toBeInTheDocument();
    });
    expect(mockApplyRules).not.toHaveBeenCalled();
  });

  it("calls applyRules and shows toast on confirmation", async () => {
    renderScreen();
    await waitFor(() => screen.getByTestId("rerun-button"));
    fireEvent.click(screen.getByTestId("rerun-button"));
    await waitFor(() => screen.getByTestId("rerun-confirm-button"));
    fireEvent.click(screen.getByTestId("rerun-confirm-button"));
    await waitFor(() => expect(mockApplyRules).toHaveBeenCalled());
    await waitFor(() => {
      expect(screen.getByTestId("rerun-toast")).toBeInTheDocument();
    });
  });

  it("does not call applyRules when confirmation is cancelled", async () => {
    renderScreen();
    await waitFor(() => screen.getByTestId("rerun-button"));
    fireEvent.click(screen.getByTestId("rerun-button"));
    await waitFor(() => screen.getByText(/overwrite/i));
    fireEvent.click(screen.getByText("Cancel"));
    expect(mockApplyRules).not.toHaveBeenCalled();
  });
});
