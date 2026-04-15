import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { PotFormSheet } from "@/components/PotFormSheet";
import * as potsLib from "@/lib/pots";
import * as refData from "@/lib/reference-data";
import type { AccountRow } from "@/lib/accounts";
import type { PotRow } from "@/lib/pots";

vi.mock("@/lib/pots", () => ({
  createPot: vi.fn(),
  updatePot: vi.fn(),
}));
vi.mock("@/lib/reference-data", () => ({
  listTags: vi.fn(),
  createTag: vi.fn(),
  CURRENCIES: ["GBP", "USD"],
  DEFAULT_CURRENCY: "GBP",
}));

const mockCreate = vi.mocked(potsLib.createPot);
const mockUpdate = vi.mocked(potsLib.updatePot);
const mockListTags = vi.mocked(refData.listTags);

const TAGS: refData.Tag[] = [
  { id: 1, name: "Personal" },
  { id: 2, name: "Joint" },
];

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

const EDIT_POT: PotRow = {
  id: 5,
  accountId: 1,
  name: "Holiday Fund",
  openingBalance: 500,
  openingDate: "2024-03-01",
  isActive: 1,
  notes: "Summer trip",
  tagId: 1,
  tagName: "Personal",
  currentBalance: 600,
};

function renderSheet(props: Partial<Parameters<typeof PotFormSheet>[0]> = {}) {
  const defaults = {
    open: true,
    onOpenChange: vi.fn(),
    account: ACCOUNT,
    onSaved: vi.fn(),
  };
  render(<PotFormSheet {...defaults} {...props} />);
  return defaults;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockListTags.mockResolvedValue(TAGS);
  mockCreate.mockResolvedValue(undefined);
  mockUpdate.mockResolvedValue(undefined);
});

describe("PotFormSheet — create mode", () => {
  it("shows 'New Pot' as the sheet title", async () => {
    renderSheet();
    await waitFor(() => {
      expect(screen.getByText("New Pot")).toBeInTheDocument();
    });
  });

  it("shows the parent account name and currency as read-only", async () => {
    renderSheet();
    await waitFor(() => {
      expect(screen.getByText("Barclays Current")).toBeInTheDocument();
      expect(screen.getByText("GBP")).toBeInTheDocument();
    });
  });

  it("renders all form fields", async () => {
    renderSheet();
    await waitFor(() => screen.getByLabelText(/name \*/i));
    expect(screen.getByLabelText(/name \*/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/opening balance/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/opening date \*/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^tag$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^notes$/i)).toBeInTheDocument();
  });

  it("opening balance defaults to 0", async () => {
    renderSheet();
    await waitFor(() => screen.getByLabelText(/opening balance/i));
    expect(screen.getByLabelText(/opening balance/i)).toHaveValue(0);
  });

  it("shows validation errors when submitting an empty form", async () => {
    renderSheet();
    await waitFor(() => screen.getByRole("button", { name: /save/i }));

    fireEvent.change(screen.getByLabelText(/name \*/i), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: /save/i }));

    await waitFor(() => {
      expect(screen.getByText("Name is required")).toBeInTheDocument();
      expect(screen.getByText("Opening date is required")).toBeInTheDocument();
    });
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("calls createPot with correct payload on save", async () => {
    renderSheet();
    await waitFor(() => screen.getByLabelText(/name \*/i));

    fireEvent.change(screen.getByLabelText(/name \*/i), {
      target: { value: "Emergency Fund" },
    });
    fireEvent.change(screen.getByLabelText(/opening balance/i), {
      target: { value: "100" },
    });
    fireEvent.change(screen.getByLabelText(/opening date \*/i), {
      target: { value: "2024-05-01" },
    });
    fireEvent.click(screen.getByRole("button", { name: /save/i }));

    await waitFor(() => {
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          accountId: 1,
          name: "Emergency Fund",
          openingBalance: 100,
          openingDate: "2024-05-01",
        }),
      );
    });
  });

  it("calls onSaved and closes the sheet after successful save", async () => {
    const onSaved = vi.fn();
    const onOpenChange = vi.fn();
    render(
      <PotFormSheet
        open={true}
        onOpenChange={onOpenChange}
        account={ACCOUNT}
        onSaved={onSaved}
      />,
    );
    await waitFor(() => screen.getByLabelText(/name \*/i));

    fireEvent.change(screen.getByLabelText(/name \*/i), {
      target: { value: "Test Pot" },
    });
    fireEvent.change(screen.getByLabelText(/opening date \*/i), {
      target: { value: "2024-01-01" },
    });
    fireEvent.click(screen.getByRole("button", { name: /save/i }));

    await waitFor(() => {
      expect(onSaved).toHaveBeenCalled();
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });

  it("shows error message when createPot throws", async () => {
    mockCreate.mockRejectedValueOnce(
      new Error("A pot with this name already exists in this account"),
    );
    renderSheet();
    await waitFor(() => screen.getByLabelText(/name \*/i));

    fireEvent.change(screen.getByLabelText(/name \*/i), {
      target: { value: "Duplicate" },
    });
    fireEvent.change(screen.getByLabelText(/opening date \*/i), {
      target: { value: "2024-01-01" },
    });
    fireEvent.click(screen.getByRole("button", { name: /save/i }));

    await waitFor(() => {
      expect(
        screen.getByText("A pot with this name already exists in this account"),
      ).toBeInTheDocument();
    });
  });
});

describe("PotFormSheet — edit mode", () => {
  it("shows 'Edit Pot' as the sheet title", async () => {
    renderSheet({ editPot: EDIT_POT });
    await waitFor(() => {
      expect(screen.getByText("Edit Pot")).toBeInTheDocument();
    });
  });

  it("pre-populates all fields from editPot", async () => {
    renderSheet({ editPot: EDIT_POT });
    await waitFor(() => screen.getByLabelText(/name \*/i));

    expect(screen.getByLabelText(/name \*/i)).toHaveValue("Holiday Fund");
    expect(screen.getByLabelText(/opening balance/i)).toHaveValue(500);
    expect(screen.getByLabelText(/opening date \*/i)).toHaveValue("2024-03-01");
    expect(screen.getByLabelText(/^notes$/i)).toHaveValue("Summer trip");
  });

  it("calls updatePot (not createPot) in edit mode", async () => {
    renderSheet({ editPot: EDIT_POT });
    await waitFor(() => screen.getByLabelText(/name \*/i));

    fireEvent.change(screen.getByLabelText(/name \*/i), {
      target: { value: "Renamed Fund" },
    });
    fireEvent.click(screen.getByRole("button", { name: /save/i }));

    await waitFor(() => {
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ id: 5, name: "Renamed Fund" }),
      );
      expect(mockCreate).not.toHaveBeenCalled();
    });
  });
});
