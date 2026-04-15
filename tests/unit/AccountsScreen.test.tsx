import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent, within } from "@testing-library/react";
import { AccountsScreen } from "@/components/AccountsScreen";
import * as accountsLib from "@/lib/accounts";
import * as potsLib from "@/lib/pots";
import * as transfersLib from "@/lib/transfers";

vi.mock("@/lib/accounts", () => ({
  listAccounts: vi.fn(),
  listAccountsWithPots: vi.fn(),
  deleteAccount: vi.fn(),
  setAccountActive: vi.fn(),
  createAccount: vi.fn(),
  updateAccount: vi.fn(),
}));

vi.mock("@/lib/pots", () => ({
  closePot: vi.fn(),
  reactivatePot: vi.fn(),
  deletePot: vi.fn(),
  getPotBalance: vi.fn(),
  createPot: vi.fn(),
  updatePot: vi.fn(),
  listPots: vi.fn(),
}));

vi.mock("@/lib/transfers", () => ({
  createPotTransfer: vi.fn(),
}));

// Prevent child forms from loading reference data in these tests
vi.mock("@/lib/institutions", () => ({
  listInstitutions: vi.fn().mockResolvedValue([]),
}));
vi.mock("@/lib/reference-data", () => ({
  listAccountTypes: vi.fn().mockResolvedValue([]),
  listTags: vi.fn().mockResolvedValue([]),
  CURRENCIES: ["GBP"],
  DEFAULT_CURRENCY: "GBP",
}));

const mockListAccountsWithPots = vi.mocked(accountsLib.listAccountsWithPots);
const mockDeleteAccount = vi.mocked(accountsLib.deleteAccount);
const mockSetAccountActive = vi.mocked(accountsLib.setAccountActive);
const mockClosePot = vi.mocked(potsLib.closePot);
const mockReactivatePot = vi.mocked(potsLib.reactivatePot);
const mockDeletePot = vi.mocked(potsLib.deletePot);
const mockGetPotBalance = vi.mocked(potsLib.getPotBalance);
const mockCreatePotTransfer = vi.mocked(transfersLib.createPotTransfer);

const POT_ACTIVE: accountsLib.AccountRow["pots"] extends Array<infer T>
  ? T
  : never = {
  id: 10,
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

const POT_CLOSED = {
  ...POT_ACTIVE,
  id: 11,
  name: "Old Pot",
  isActive: 0,
  currentBalance: 0,
};

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
  pots: [POT_ACTIVE, POT_CLOSED],
};

const INACTIVE_ACCOUNT: accountsLib.AccountRow = {
  ...ACTIVE_ACCOUNT,
  id: 2,
  name: "Old Savings",
  isActive: 0,
  pots: [],
};

beforeEach(() => {
  vi.clearAllMocks();
  mockListAccountsWithPots.mockResolvedValue([ACTIVE_ACCOUNT]);
  mockDeleteAccount.mockResolvedValue(undefined);
  mockSetAccountActive.mockResolvedValue(undefined);
  mockClosePot.mockResolvedValue(undefined);
  mockReactivatePot.mockResolvedValue(undefined);
  mockDeletePot.mockResolvedValue(undefined);
  mockGetPotBalance.mockResolvedValue(0);
  mockCreatePotTransfer.mockResolvedValue(undefined);
});

describe("AccountsScreen", () => {
  it("shows an empty-state message when no accounts exist", async () => {
    mockListAccountsWithPots.mockResolvedValue([]);
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

  it("calls listAccountsWithPots on initial render", async () => {
    render(<AccountsScreen />);
    await waitFor(() =>
      expect(mockListAccountsWithPots).toHaveBeenCalledWith(false, null, true),
    );
  });

  it("calls listAccountsWithPots with showInactive=true when the inactive toggle is switched on", async () => {
    mockListAccountsWithPots.mockResolvedValue([ACTIVE_ACCOUNT, INACTIVE_ACCOUNT]);
    render(<AccountsScreen />);
    await waitFor(() => screen.getAllByRole("switch"));

    // First switch is the "Show inactive accounts" one
    const switches = screen.getAllByRole("switch");
    fireEvent.click(switches[0]);

    await waitFor(() =>
      expect(mockListAccountsWithPots).toHaveBeenCalledWith(true, null, true),
    );
  });

  it("renders inactive accounts with reduced opacity", async () => {
    mockListAccountsWithPots.mockResolvedValue([
      ACTIVE_ACCOUNT,
      INACTIVE_ACCOUNT,
    ]);
    render(<AccountsScreen />);
    await waitFor(() => screen.getByText("Old Savings"));

    const rows = screen.getAllByRole("row");
    const inactiveRow = rows.find((r) => within(r).queryByText("Old Savings"));
    expect(inactiveRow).toHaveClass("opacity-40");
  });

  it("opens the delete confirmation dialog when Delete is chosen from the row menu", async () => {
    render(<AccountsScreen />);
    await waitFor(() => screen.getByText("Current Account"));

    const triggerBtn = screen.getByRole("button", { name: /account actions/i });
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
    render(<AccountsScreen />);
    await waitFor(() => screen.getByText("Current Account"));

    const triggerBtn = screen.getByRole("button", { name: /account actions/i });
    fireEvent.pointerDown(triggerBtn, { button: 0, ctrlKey: false });
    await waitFor(() => screen.getByText("Delete"));
    fireEvent.click(screen.getByText("Delete"));

    await waitFor(() => screen.getByText(/delete account\?/i));
    fireEvent.click(screen.getByRole("button", { name: /^delete$/i }));

    await waitFor(() => {
      expect(mockDeleteAccount).toHaveBeenCalledWith(1);
      expect(mockListAccountsWithPots).toHaveBeenCalledTimes(2);
    });
  });

  it("calls setAccountActive to deactivate and refreshes the list", async () => {
    render(<AccountsScreen />);
    await waitFor(() => screen.getByText("Current Account"));

    const triggerBtn = screen.getByRole("button", { name: /account actions/i });
    fireEvent.pointerDown(triggerBtn, { button: 0, ctrlKey: false });
    await waitFor(() => screen.getByText("Deactivate"));
    fireEvent.click(screen.getByText("Deactivate"));

    await waitFor(() => {
      expect(mockSetAccountActive).toHaveBeenCalledWith(1, false);
      expect(mockListAccountsWithPots).toHaveBeenCalledTimes(2);
    });
  });
});

describe("AccountsScreen — pot child rows", () => {
  it("renders active pot child row under its parent account", async () => {
    render(<AccountsScreen />);
    await waitFor(() => screen.getByText("Holiday Fund"));
    expect(screen.getByText("Holiday Fund")).toBeInTheDocument();
    expect(screen.getByText("300.00")).toBeInTheDocument();
  });

  it("does not render closed pot child row when toggle is off", async () => {
    render(<AccountsScreen />);
    await waitFor(() => screen.getByText("Holiday Fund"));
    expect(screen.queryByText("Old Pot")).not.toBeInTheDocument();
  });

  it("shows closed pot when 'Show closed pots' toggle is enabled", async () => {
    render(<AccountsScreen />);
    await waitFor(() => screen.getByText("Holiday Fund"));

    // Find the per-account "Show closed pots" switch
    const closedPotsSwitch = screen.getByRole("switch", {
      name: /show closed pots for current account/i,
    });
    fireEvent.click(closedPotsSwitch);

    await waitFor(() => {
      expect(screen.getByText("Old Pot")).toBeInTheDocument();
    });
  });

  it("renders an 'Add pot' button per account", async () => {
    render(<AccountsScreen />);
    await waitFor(() =>
      screen.getByRole("button", { name: /add pot to current account/i }),
    );
  });

  it("opens pot delete confirmation with permanent warning", async () => {
    render(<AccountsScreen />);
    await waitFor(() => screen.getByText("Holiday Fund"));

    const potActionsBtns = screen.getAllByRole("button", { name: /pot actions/i });
    fireEvent.pointerDown(potActionsBtns[0], { button: 0, ctrlKey: false });
    await waitFor(() => screen.getAllByText("Delete"));

    // Click the last Delete in the dropdown (pot delete, not account delete)
    const deleteItems = screen.getAllByText("Delete");
    fireEvent.click(deleteItems[deleteItems.length - 1]);

    await waitFor(() => {
      expect(screen.getByText(/delete pot permanently/i)).toBeInTheDocument();
      expect(screen.getByText(/permanently removed/i)).toBeInTheDocument();
    });
  });

  it("calls deletePot and refreshes on confirmed pot delete", async () => {
    render(<AccountsScreen />);
    await waitFor(() => screen.getByText("Holiday Fund"));

    const potActionsBtns = screen.getAllByRole("button", { name: /pot actions/i });
    fireEvent.pointerDown(potActionsBtns[0], { button: 0, ctrlKey: false });
    await waitFor(() => screen.getAllByText("Delete"));
    const deleteItems = screen.getAllByText("Delete");
    fireEvent.click(deleteItems[deleteItems.length - 1]);

    await waitFor(() => screen.getByText(/delete pot permanently/i));
    fireEvent.click(screen.getByRole("button", { name: /delete permanently/i }));

    await waitFor(() => {
      expect(mockDeletePot).toHaveBeenCalledWith(10);
      expect(mockListAccountsWithPots).toHaveBeenCalledTimes(2);
    });
  });

  it("calls closePot directly when pot balance is zero", async () => {
    mockGetPotBalance.mockResolvedValue(0);
    render(<AccountsScreen />);
    await waitFor(() => screen.getByText("Holiday Fund"));

    const potActionsBtns = screen.getAllByRole("button", { name: /pot actions/i });
    fireEvent.pointerDown(potActionsBtns[0], { button: 0, ctrlKey: false });
    await waitFor(() => screen.getByText("Close"));
    fireEvent.click(screen.getByText("Close"));

    await waitFor(() => {
      expect(mockClosePot).toHaveBeenCalledWith(10);
    });
  });

  it("shows close warning dialog when pot balance is non-zero", async () => {
    mockGetPotBalance.mockResolvedValue(150);
    render(<AccountsScreen />);
    await waitFor(() => screen.getByText("Holiday Fund"));

    const potActionsBtns = screen.getAllByRole("button", { name: /pot actions/i });
    fireEvent.pointerDown(potActionsBtns[0], { button: 0, ctrlKey: false });
    await waitFor(() => screen.getByText("Close"));
    fireEvent.click(screen.getByText("Close"));

    await waitFor(() => {
      expect(
        screen.getByText(/close pot with remaining balance/i),
      ).toBeInTheDocument();
    });
  });
});

describe("AccountsScreen — tagId prop", () => {
  it("passes tagId to listAccountsWithPots on initial render", async () => {
    render(<AccountsScreen tagId={1} />);
    await waitFor(() =>
      expect(mockListAccountsWithPots).toHaveBeenCalledWith(false, 1, true),
    );
  });

  it("passes null tagId to listAccountsWithPots when not provided", async () => {
    render(<AccountsScreen />);
    await waitFor(() =>
      expect(mockListAccountsWithPots).toHaveBeenCalledWith(false, null, true),
    );
  });

  it("re-fetches accounts when tagId prop changes", async () => {
    const { rerender } = render(<AccountsScreen tagId={null} />);
    await waitFor(() => expect(mockListAccountsWithPots).toHaveBeenCalledTimes(1));

    rerender(<AccountsScreen tagId={1} />);
    await waitFor(() =>
      expect(mockListAccountsWithPots).toHaveBeenCalledTimes(2),
    );
    expect(mockListAccountsWithPots).toHaveBeenLastCalledWith(false, 1, true);
  });

  it("shows only accounts returned for the selected tagId", async () => {
    const taggedAccount: accountsLib.AccountRow = {
      ...ACTIVE_ACCOUNT,
      id: 3,
      name: "Personal Savings",
      tagId: 1,
      tagName: "Personal",
      pots: [],
    };
    mockListAccountsWithPots.mockResolvedValue([taggedAccount]);

    render(<AccountsScreen tagId={1} />);
    await waitFor(() => {
      expect(screen.getByText("Personal Savings")).toBeInTheDocument();
      expect(screen.queryByText("Current Account")).not.toBeInTheDocument();
    });
  });
});
