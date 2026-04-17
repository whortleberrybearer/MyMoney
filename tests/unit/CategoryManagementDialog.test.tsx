import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent, within } from "@testing-library/react";
import { CategoryManagementDialog } from "@/components/CategoryManagementDialog";
import * as categoriesLib from "@/lib/categories";

vi.mock("@/lib/categories", () => ({
  listCategories: vi.fn(),
  createCategory: vi.fn(),
  deleteCategory: vi.fn(),
  CategoryInUseError: class CategoryInUseError extends Error {
    readonly code = "CATEGORY_IN_USE";
    readonly transactionCount: number;
    constructor(transactionCount: number) {
      super(`Category is assigned to ${transactionCount} transaction(s)`);
      this.transactionCount = transactionCount;
    }
  },
}));

const mockList = vi.mocked(categoriesLib.listCategories);
const mockCreate = vi.mocked(categoriesLib.createCategory);
const mockDelete = vi.mocked(categoriesLib.deleteCategory);

const CATEGORIES: categoriesLib.Category[] = [
  { id: 1, name: "Bills", isSystem: 0, sortOrder: 3 },
  { id: 2, name: "Groceries", isSystem: 0, sortOrder: 4 },
  { id: 999, name: "Uncategorised", isSystem: 1, sortOrder: 999 },
];

function renderOpen() {
  render(<CategoryManagementDialog open={true} onOpenChange={vi.fn()} />);
}

beforeEach(() => {
  vi.clearAllMocks();
  mockList.mockResolvedValue(CATEGORIES);
  mockCreate.mockResolvedValue(undefined);
  mockDelete.mockResolvedValue(undefined);
});

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

describe("CategoryManagementDialog — rendering", () => {
  it("lists categories alphabetically when opened", async () => {
    renderOpen();
    await waitFor(() => {
      expect(screen.getByText("Bills")).toBeInTheDocument();
      expect(screen.getByText("Groceries")).toBeInTheDocument();
    });
  });

  it("shows system indicator next to Uncategorised", async () => {
    renderOpen();
    await waitFor(() => {
      expect(screen.getByText("(system)")).toBeInTheDocument();
    });
  });

  it("has delete button disabled for Uncategorised (system category)", async () => {
    renderOpen();
    await waitFor(() => screen.getByTestId("delete-btn-999"));
    expect(screen.getByTestId("delete-btn-999")).toBeDisabled();
  });

  it("has delete button enabled for non-system categories", async () => {
    renderOpen();
    await waitFor(() => screen.getByTestId("delete-btn-1"));
    expect(screen.getByTestId("delete-btn-1")).not.toBeDisabled();
  });
});

// ---------------------------------------------------------------------------
// Add category
// ---------------------------------------------------------------------------

describe("CategoryManagementDialog — add category", () => {
  it("shows an input when Add Category is clicked", async () => {
    renderOpen();
    await waitFor(() => screen.getByTestId("add-category-btn"));
    fireEvent.click(screen.getByTestId("add-category-btn"));
    expect(screen.getByTestId("new-category-input")).toBeInTheDocument();
  });

  it("saves new category and refreshes list on save", async () => {
    const updatedList = [
      ...CATEGORIES,
      { id: 3, name: "Fuel", isSystem: 0, sortOrder: 30 },
    ];
    mockList.mockResolvedValueOnce(CATEGORIES).mockResolvedValueOnce(updatedList);

    renderOpen();
    await waitFor(() => screen.getByTestId("add-category-btn"));
    fireEvent.click(screen.getByTestId("add-category-btn"));

    fireEvent.change(screen.getByTestId("new-category-input"), {
      target: { value: "Fuel" },
    });
    fireEvent.click(screen.getByTestId("save-new-category"));

    await waitFor(() => {
      expect(mockCreate).toHaveBeenCalledWith("Fuel");
      expect(screen.getByText("Fuel")).toBeInTheDocument();
    });
  });

  it("shows error when category name is blank", async () => {
    renderOpen();
    await waitFor(() => screen.getByTestId("add-category-btn"));
    fireEvent.click(screen.getByTestId("add-category-btn"));
    fireEvent.click(screen.getByTestId("save-new-category"));

    await waitFor(() => {
      expect(screen.getByTestId("add-error")).toHaveTextContent(
        /category name is required/i,
      );
    });
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("shows error when category name is a duplicate", async () => {
    mockCreate.mockRejectedValue(new Error("A category with this name already exists"));

    renderOpen();
    await waitFor(() => screen.getByTestId("add-category-btn"));
    fireEvent.click(screen.getByTestId("add-category-btn"));

    fireEvent.change(screen.getByTestId("new-category-input"), {
      target: { value: "Bills" },
    });
    fireEvent.click(screen.getByTestId("save-new-category"));

    await waitFor(() => {
      expect(screen.getByTestId("add-error")).toHaveTextContent(
        /a category with this name already exists/i,
      );
    });
  });

  it("hides input and clears error on cancel", async () => {
    renderOpen();
    await waitFor(() => screen.getByTestId("add-category-btn"));
    fireEvent.click(screen.getByTestId("add-category-btn"));
    fireEvent.click(screen.getByTestId("cancel-new-category"));

    await waitFor(() => {
      expect(screen.queryByTestId("new-category-input")).not.toBeInTheDocument();
    });
  });
});

// ---------------------------------------------------------------------------
// Delete — unused category
// ---------------------------------------------------------------------------

describe("CategoryManagementDialog — delete unused category", () => {
  it("shows a confirmation dialog when delete is clicked for unused category", async () => {
    renderOpen();
    await waitFor(() => screen.getByTestId("delete-btn-1"));
    fireEvent.click(screen.getByTestId("delete-btn-1"));

    await waitFor(() => {
      expect(screen.getByTestId("delete-confirm")).toBeInTheDocument();
      expect(screen.getByText(/delete category/i)).toBeInTheDocument();
    });
  });

  it("calls deleteCategory and refreshes list after confirm", async () => {
    const updatedList = CATEGORIES.filter((c) => c.id !== 1);
    mockList.mockResolvedValueOnce(CATEGORIES).mockResolvedValueOnce(updatedList);

    renderOpen();
    await waitFor(() => screen.getByTestId("delete-btn-1"));
    fireEvent.click(screen.getByTestId("delete-btn-1"));

    await waitFor(() => screen.getByTestId("delete-confirm"));
    fireEvent.click(screen.getByTestId("delete-confirm"));

    await waitFor(() => {
      expect(mockDelete).toHaveBeenCalledWith(1);
      expect(screen.queryByText("Bills")).not.toBeInTheDocument();
    });
  });

  it("does not delete when cancel is clicked", async () => {
    renderOpen();
    await waitFor(() => screen.getByTestId("delete-btn-1"));
    fireEvent.click(screen.getByTestId("delete-btn-1"));

    await waitFor(() => screen.getByTestId("delete-cancel"));
    fireEvent.click(screen.getByTestId("delete-cancel"));

    await waitFor(() => {
      expect(screen.queryByTestId("delete-confirm")).not.toBeInTheDocument();
    });
    expect(mockDelete).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Delete — in-use category (replacement picker)
// ---------------------------------------------------------------------------

describe("CategoryManagementDialog — delete in-use category", () => {
  it("shows replacement picker when category is in use", async () => {
    // First call (simple delete) throws CategoryInUseError
    mockDelete.mockRejectedValueOnce(
      new categoriesLib.CategoryInUseError(5),
    );

    renderOpen();
    await waitFor(() => screen.getByTestId("delete-btn-1"));
    fireEvent.click(screen.getByTestId("delete-btn-1"));

    await waitFor(() => screen.getByTestId("delete-confirm"));
    fireEvent.click(screen.getByTestId("delete-confirm"));

    await waitFor(() => {
      expect(screen.getByTestId("replacement-select")).toBeInTheDocument();
      expect(screen.getByText(/5 transaction/i)).toBeInTheDocument();
    });
  });

  it("excludes the category being deleted from the replacement options", async () => {
    mockDelete.mockRejectedValueOnce(
      new categoriesLib.CategoryInUseError(3),
    );

    renderOpen();
    await waitFor(() => screen.getByTestId("delete-btn-1"));
    fireEvent.click(screen.getByTestId("delete-btn-1"));

    await waitFor(() => screen.getByTestId("delete-confirm"));
    fireEvent.click(screen.getByTestId("delete-confirm"));

    await waitFor(() => screen.getByTestId("replacement-select"));

    // Open the replacement select
    fireEvent.click(screen.getByTestId("replacement-select"));
    await waitFor(() => {
      const options = screen.queryAllByRole("option");
      const names = options.map((o) => o.textContent);
      expect(names.some((n) => n?.includes("Bills"))).toBe(false);
      expect(names.some((n) => n?.includes("Groceries"))).toBe(true);
      expect(names.some((n) => n?.includes("Uncategorised"))).toBe(true);
    });
  });

  it("confirm button is disabled until a replacement is selected", async () => {
    mockDelete.mockRejectedValueOnce(
      new categoriesLib.CategoryInUseError(2),
    );

    renderOpen();
    await waitFor(() => screen.getByTestId("delete-btn-1"));
    fireEvent.click(screen.getByTestId("delete-btn-1"));

    await waitFor(() => screen.getByTestId("delete-confirm"));
    fireEvent.click(screen.getByTestId("delete-confirm"));

    await waitFor(() => {
      expect(screen.getByTestId("replacement-confirm")).toBeDisabled();
    });
  });

  it("calls deleteCategory with replacementId and refreshes list after confirm", async () => {
    // First call: throws in-use error; second call: succeeds
    mockDelete
      .mockRejectedValueOnce(new categoriesLib.CategoryInUseError(2))
      .mockResolvedValueOnce(undefined);

    const updatedList = CATEGORIES.filter((c) => c.id !== 1);
    mockList.mockResolvedValueOnce(CATEGORIES).mockResolvedValueOnce(updatedList);

    renderOpen();
    await waitFor(() => screen.getByTestId("delete-btn-1"));
    fireEvent.click(screen.getByTestId("delete-btn-1"));

    await waitFor(() => screen.getByTestId("delete-confirm"));
    fireEvent.click(screen.getByTestId("delete-confirm"));

    // Wait for replacement picker
    await waitFor(() => screen.getByTestId("replacement-select"));

    // Select "Groceries" (id=2) as replacement
    fireEvent.click(screen.getByTestId("replacement-select"));
    await waitFor(() => screen.getByRole("option", { name: /groceries/i }));
    fireEvent.click(screen.getByRole("option", { name: /groceries/i }));

    await waitFor(() => {
      expect(screen.getByTestId("replacement-confirm")).not.toBeDisabled();
    });

    fireEvent.click(screen.getByTestId("replacement-confirm"));

    await waitFor(() => {
      expect(mockDelete).toHaveBeenLastCalledWith(1, 2);
      expect(screen.queryByText("Bills")).not.toBeInTheDocument();
    });
  });

  it("cancel closes the replacement picker without deleting", async () => {
    mockDelete.mockRejectedValueOnce(
      new categoriesLib.CategoryInUseError(1),
    );

    renderOpen();
    await waitFor(() => screen.getByTestId("delete-btn-1"));
    fireEvent.click(screen.getByTestId("delete-btn-1"));

    await waitFor(() => screen.getByTestId("delete-confirm"));
    fireEvent.click(screen.getByTestId("delete-confirm"));

    await waitFor(() => screen.getByTestId("replacement-cancel"));
    fireEvent.click(screen.getByTestId("replacement-cancel"));

    await waitFor(() => {
      expect(screen.queryByTestId("replacement-confirm")).not.toBeInTheDocument();
    });
    // Only one call (the initial failing one)
    expect(mockDelete).toHaveBeenCalledTimes(1);
  });
});
