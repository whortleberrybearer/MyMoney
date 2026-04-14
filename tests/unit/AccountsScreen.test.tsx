import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent, within } from "@testing-library/react";
import { AccountsScreen } from "@/components/AccountsScreen";
import * as accountsLib from "@/lib/accounts";

vi.mock("@/lib/accounts", () => ({
  listAccounts: vi.fn(),
  deleteAccount: vi.fn(),
  setAccountActive: vi.fn(),
  createAccount: vi.fn(),
  updateAccount: vi.fn(),
}));

// Prevent AccountFormSheet from loading reference data in these tests
vi.mock("@/lib/institutions", () => ({ listInstitutions: vi.fn().mockResolvedValue([]) }));
vi.mock("@/lib/reference-data", () => ({
  listAccountTypes: vi.fn().mockResolvedValue([]),
  listTags: vi.fn().mockResolvedValue([]),
  CURRENCIES: ["GBP"],
  DEFAULT_CURRENCY: "GBP",
}));

const mockListAccounts = vi.mocked(accountsLib.listAccounts);
const mockDeleteAccount = vi.mocked(accountsLib.deleteAccount);
const mockSetAccountActive = vi.mocked(accountsLib.setAccountActive);

const ACTIVE_ACCOUNT: accountsLib.AccountRow = {
  id: 1,
  name: "Current Account",
  institutionId: 1,
  institutionName: "Barclays",
  accountTypeId: 1,
  accountTypeName: "Current",
  currency: "GBP",
  openingBalance: 1234.56,
  openingDate: "2024-01-01",
  notes: null,
  isActive: 1,
  tagId: null,
  tagName: null,
};

const INACTIVE_ACCOUNT: accountsLib.AccountRow = {
  ...ACTIVE_ACCOUNT,
  id: 2,
  name: "Old Savings",
  isActive: 0,
};

beforeEach(() => {
  vi.clearAllMocks();
  mockListAccounts.mockResolvedValue([ACTIVE_ACCOUNT]);
  mockDeleteAccount.mockResolvedValue(undefined);
  mockSetAccountActive.mockResolvedValue(undefined);
});

describe("AccountsScreen", () => {
  it("shows an empty-state message when no accounts exist", async () => {
    mockListAccounts.mockResolvedValue([]);
    render(<AccountsScreen />);
    await waitFor(() => {
      expect(screen.getByText(/no active accounts/i)).toBeInTheDocument();
    });
  });

  it("renders account rows with institution, name, type, currency, and balance", async () => {
    render(<AccountsScreen />);
    await waitFor(() => {
      expect(screen.getByText("Current Account")).toBeInTheDocument();
    });
    expect(screen.getByText("Barclays")).toBeInTheDocument();
    expect(screen.getByText("Current")).toBeInTheDocument();
    expect(screen.getByText("GBP")).toBeInTheDocument();
    expect(screen.getByText("1234.56")).toBeInTheDocument();
  });

  it("calls listAccounts with showInactive=false on initial render", async () => {
    render(<AccountsScreen />);
    await waitFor(() => expect(mockListAccounts).toHaveBeenCalledWith(false));
  });

  it("calls listAccounts with showInactive=true when the inactive toggle is switched on", async () => {
    mockListAccounts.mockResolvedValue([ACTIVE_ACCOUNT, INACTIVE_ACCOUNT]);
    render(<AccountsScreen />);
    await waitFor(() => screen.getByRole("switch"));

    fireEvent.click(screen.getByRole("switch"));

    await waitFor(() => expect(mockListAccounts).toHaveBeenCalledWith(true));
  });

  it("renders inactive accounts with reduced opacity", async () => {
    mockListAccounts.mockResolvedValue([ACTIVE_ACCOUNT, INACTIVE_ACCOUNT]);
    render(<AccountsScreen />);
    await waitFor(() => screen.getByText("Old Savings"));

    const rows = screen.getAllByRole("row");
    // Header row + 2 data rows; the inactive row should have opacity-40
    const inactiveRow = rows.find((r) => within(r).queryByText("Old Savings"));
    expect(inactiveRow).toHaveClass("opacity-40");
  });

  it("opens the delete confirmation dialog when Delete is chosen from the row menu", async () => {
    render(<AccountsScreen />);
    await waitFor(() => screen.getByText("Current Account"));

    // Open the row actions dropdown (Radix DropdownMenu opens on pointerdown)
    const triggerBtn = screen.getByRole("button", { name: /row actions/i });
    fireEvent.pointerDown(triggerBtn, { button: 0, ctrlKey: false });
    await waitFor(() => screen.getByText("Delete"));
    fireEvent.click(screen.getByText("Delete"));

    await waitFor(() => {
      expect(screen.getByText(/delete account\?/i)).toBeInTheDocument();
    });
    const alertDialog = screen.getByRole("alertdialog");
    expect(within(alertDialog).getByText(/current account/i)).toBeInTheDocument();
  });

  it("calls deleteAccount and refreshes when delete is confirmed", async () => {
    mockListAccounts.mockResolvedValue([ACTIVE_ACCOUNT]);
    render(<AccountsScreen />);
    await waitFor(() => screen.getByText("Current Account"));

    const triggerBtn = screen.getByRole("button", { name: /row actions/i });
    fireEvent.pointerDown(triggerBtn, { button: 0, ctrlKey: false });
    await waitFor(() => screen.getByText("Delete"));
    fireEvent.click(screen.getByText("Delete"));

    await waitFor(() => screen.getByText(/delete account\?/i));
    fireEvent.click(screen.getByRole("button", { name: /^delete$/i }));

    await waitFor(() => {
      expect(mockDeleteAccount).toHaveBeenCalledWith(1);
      expect(mockListAccounts).toHaveBeenCalledTimes(2); // initial + after delete
    });
  });

  it("calls setAccountActive to deactivate and refreshes the list", async () => {
    render(<AccountsScreen />);
    await waitFor(() => screen.getByText("Current Account"));

    const triggerBtn = screen.getByRole("button", { name: /row actions/i });
    fireEvent.pointerDown(triggerBtn, { button: 0, ctrlKey: false });
    await waitFor(() => screen.getByText("Deactivate"));
    fireEvent.click(screen.getByText("Deactivate"));

    await waitFor(() => {
      expect(mockSetAccountActive).toHaveBeenCalledWith(1, false);
      expect(mockListAccounts).toHaveBeenCalledTimes(2);
    });
  });
});
