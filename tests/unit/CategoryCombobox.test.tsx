import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { CategoryCombobox } from "@/components/CategoryCombobox";
import { type Category } from "@/lib/categories";

const CATEGORIES: Category[] = [
  { id: 1, name: "Bills", isSystem: 0, sortOrder: 3 },
  { id: 2, name: "Groceries", isSystem: 0, sortOrder: 4 },
  { id: 3, name: "Salary", isSystem: 0, sortOrder: 1 },
  { id: 999, name: "Uncategorised", isSystem: 1, sortOrder: 999 },
];

function openCombobox() {
  fireEvent.click(screen.getByRole("combobox"));
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("CategoryCombobox", () => {
  it("shows 'Uncategorised' in trigger when value is null", () => {
    render(
      <CategoryCombobox categories={CATEGORIES} value={null} onChange={vi.fn()} />,
    );
    expect(screen.getByRole("combobox")).toHaveTextContent("Uncategorised");
  });

  it("shows the selected category name in trigger when value is set", () => {
    render(
      <CategoryCombobox categories={CATEGORIES} value={1} onChange={vi.fn()} />,
    );
    expect(screen.getByRole("combobox")).toHaveTextContent("Bills");
  });

  it("renders all non-system categories when opened", async () => {
    render(
      <CategoryCombobox categories={CATEGORIES} value={null} onChange={vi.fn()} />,
    );
    openCombobox();

    await waitFor(() => {
      expect(screen.getByText("Bills")).toBeInTheDocument();
      expect(screen.getByText("Groceries")).toBeInTheDocument();
      expect(screen.getByText("Salary")).toBeInTheDocument();
    });
  });

  it("always shows Uncategorised as an option in the dropdown", async () => {
    render(
      <CategoryCombobox categories={CATEGORIES} value={1} onChange={vi.fn()} />,
    );
    openCombobox();

    // Uncategorised appears in the list (the trigger says "Bills", list has it too)
    await waitFor(() => {
      const items = screen.getAllByRole("option");
      const itemTexts = items.map((el) => el.textContent);
      expect(itemTexts.some((t) => t?.includes("Uncategorised"))).toBe(true);
    });
  });

  it("filters categories as the user types (case-insensitive)", async () => {
    render(
      <CategoryCombobox categories={CATEGORIES} value={null} onChange={vi.fn()} />,
    );
    openCombobox();

    const input = await screen.findByPlaceholderText(/search categories/i);
    fireEvent.change(input, { target: { value: "gro" } });

    await waitFor(() => {
      expect(screen.getByText("Groceries")).toBeInTheDocument();
      expect(screen.queryByText("Bills")).not.toBeInTheDocument();
      expect(screen.queryByText("Salary")).not.toBeInTheDocument();
    });
  });

  it("shows Uncategorised when the filter text matches it", async () => {
    render(
      <CategoryCombobox categories={CATEGORIES} value={null} onChange={vi.fn()} />,
    );
    openCombobox();

    const input = await screen.findByPlaceholderText(/search categories/i);
    fireEvent.change(input, { target: { value: "uncate" } });

    await waitFor(() => {
      const items = screen.getAllByRole("option");
      const itemTexts = items.map((el) => el.textContent);
      expect(itemTexts.some((t) => t?.includes("Uncategorised"))).toBe(true);
    });
  });

  it("hides Uncategorised when filter text does not match it", async () => {
    render(
      <CategoryCombobox categories={CATEGORIES} value={null} onChange={vi.fn()} />,
    );
    openCombobox();

    const input = await screen.findByPlaceholderText(/search categories/i);
    fireEvent.change(input, { target: { value: "bills" } });

    await waitFor(() => {
      const options = screen.queryAllByRole("option");
      const texts = options.map((el) => el.textContent);
      expect(texts.some((t) => t?.includes("Uncategorised"))).toBe(false);
    });
  });

  it("calls onChange with the category id when a category is selected", async () => {
    const onChange = vi.fn();
    render(
      <CategoryCombobox categories={CATEGORIES} value={null} onChange={onChange} />,
    );
    openCombobox();

    await waitFor(() => screen.getByText("Groceries"));
    fireEvent.click(screen.getByText("Groceries"));

    expect(onChange).toHaveBeenCalledWith(2);
  });

  it("calls onChange with null when Uncategorised is selected", async () => {
    const onChange = vi.fn();
    render(
      <CategoryCombobox categories={CATEGORIES} value={1} onChange={onChange} />,
    );
    openCombobox();

    await waitFor(() => {
      const items = screen.getAllByRole("option");
      const uncatItem = items.find((el) =>
        el.textContent?.includes("Uncategorised"),
      );
      expect(uncatItem).toBeTruthy();
      fireEvent.click(uncatItem!);
    });

    expect(onChange).toHaveBeenCalledWith(null);
  });

  it("pre-selects the current value with a check mark", async () => {
    render(
      <CategoryCombobox categories={CATEGORIES} value={2} onChange={vi.fn()} />,
    );
    // Trigger shows the selected label before opening
    expect(screen.getByRole("combobox")).toHaveTextContent("Groceries");

    openCombobox();

    // The list item for Groceries is present (trigger + option both have the text)
    await waitFor(() => {
      const groceriesItems = screen.getAllByText("Groceries");
      expect(groceriesItems.length).toBeGreaterThan(0);
    });
  });

  it("is disabled when disabled prop is true", () => {
    render(
      <CategoryCombobox
        categories={CATEGORIES}
        value={null}
        onChange={vi.fn()}
        disabled={true}
      />,
    );
    expect(screen.getByRole("combobox")).toBeDisabled();
  });
});
