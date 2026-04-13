import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent, within } from "@testing-library/react";
import { InstitutionManagementDialog } from "@/components/InstitutionManagementDialog";
import * as institutionsLib from "@/lib/institutions";

vi.mock("@/lib/institutions", () => ({
  listInstitutions: vi.fn(),
  createInstitution: vi.fn(),
  updateInstitution: vi.fn(),
  deleteInstitution: vi.fn(),
}));

const mockList = vi.mocked(institutionsLib.listInstitutions);
const mockCreate = vi.mocked(institutionsLib.createInstitution);
const mockUpdate = vi.mocked(institutionsLib.updateInstitution);
const mockDelete = vi.mocked(institutionsLib.deleteInstitution);

const INSTITUTIONS: institutionsLib.Institution[] = [
  { id: 1, name: "Barclays" },
  { id: 2, name: "HSBC" },
];

function renderOpen() {
  const onOpenChange = vi.fn();
  render(
    <InstitutionManagementDialog open={true} onOpenChange={onOpenChange} />,
  );
  return { onOpenChange };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockList.mockResolvedValue(INSTITUTIONS);
  mockCreate.mockResolvedValue(undefined);
  mockUpdate.mockResolvedValue(undefined);
  mockDelete.mockResolvedValue(undefined);
});

describe("InstitutionManagementDialog", () => {
  it("lists institutions when opened", async () => {
    renderOpen();
    await waitFor(() => {
      expect(screen.getByText("Barclays")).toBeInTheDocument();
      expect(screen.getByText("HSBC")).toBeInTheDocument();
    });
  });

  it("shows an inline input and saves when Add Institution is clicked", async () => {
    mockList
      .mockResolvedValueOnce(INSTITUTIONS)
      .mockResolvedValueOnce([...INSTITUTIONS, { id: 3, name: "Monzo" }]);

    renderOpen();
    await waitFor(() => screen.getByText("Add Institution"));

    fireEvent.click(screen.getByText("Add Institution"));

    const input = screen.getByPlaceholderText("Institution name");
    fireEvent.change(input, { target: { value: "Monzo" } });
    fireEvent.click(screen.getByRole("button", { name: /^save$/i }));

    await waitFor(() => expect(mockCreate).toHaveBeenCalledWith("Monzo"));
  });

  it("shows a validation error when saving an empty name", async () => {
    renderOpen();
    await waitFor(() => screen.getByText("Add Institution"));

    fireEvent.click(screen.getByText("Add Institution"));
    fireEvent.click(screen.getByRole("button", { name: /^save$/i }));

    await waitFor(() => {
      expect(screen.getByText("Name is required")).toBeInTheDocument();
    });
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("shows an inline input pre-filled with the institution name when Edit is clicked", async () => {
    renderOpen();
    await waitFor(() => screen.getByText("Barclays"));

    const editButtons = screen.getAllByRole("button", { name: /edit/i });
    fireEvent.click(editButtons[0]); // Edit Barclays

    const input = screen.getByDisplayValue("Barclays");
    expect(input).toBeInTheDocument();
  });

  it("calls updateInstitution and refreshes when a rename is saved", async () => {
    mockList
      .mockResolvedValueOnce(INSTITUTIONS)
      .mockResolvedValueOnce([{ id: 1, name: "Barclays PLC" }, { id: 2, name: "HSBC" }]);

    renderOpen();
    await waitFor(() => screen.getByText("Barclays"));

    const editButtons = screen.getAllByRole("button", { name: /edit/i });
    fireEvent.click(editButtons[0]);

    const input = screen.getByDisplayValue("Barclays");
    fireEvent.change(input, { target: { value: "Barclays PLC" } });
    fireEvent.click(screen.getByRole("button", { name: /^save$/i }));

    await waitFor(() =>
      expect(mockUpdate).toHaveBeenCalledWith(1, "Barclays PLC"),
    );
  });

  it("shows a delete confirmation dialog when Delete is clicked", async () => {
    renderOpen();
    await waitFor(() => screen.getByText("Barclays"));

    const deleteButtons = screen.getAllByRole("button", { name: /delete/i });
    fireEvent.click(deleteButtons[0]);

    await waitFor(() => {
      expect(screen.getByText(/delete institution\?/i)).toBeInTheDocument();
    });
    const alertDialog = screen.getByRole("alertdialog");
    expect(within(alertDialog).getByText(/barclays/i)).toBeInTheDocument();
  });

  it("calls deleteInstitution and refreshes when deletion is confirmed", async () => {
    mockList
      .mockResolvedValueOnce(INSTITUTIONS)
      .mockResolvedValueOnce([{ id: 2, name: "HSBC" }]);

    renderOpen();
    await waitFor(() => screen.getByText("Barclays"));

    const deleteButtons = screen.getAllByRole("button", { name: /delete/i });
    fireEvent.click(deleteButtons[0]);

    await waitFor(() => screen.getByText(/delete institution\?/i));
    fireEvent.click(screen.getByRole("button", { name: /^delete$/i }));

    await waitFor(() => expect(mockDelete).toHaveBeenCalledWith(1));
  });

  it("shows an error message when deleting an institution with linked accounts", async () => {
    mockDelete.mockRejectedValueOnce(
      new Error("Cannot delete an institution that has linked accounts"),
    );

    renderOpen();
    await waitFor(() => screen.getByText("Barclays"));

    const deleteButtons = screen.getAllByRole("button", { name: /delete/i });
    fireEvent.click(deleteButtons[0]);
    await waitFor(() => screen.getByText(/delete institution\?/i));
    fireEvent.click(screen.getByRole("button", { name: /^delete$/i }));

    await waitFor(() => {
      expect(
        screen.getByText(/cannot delete an institution that has linked accounts/i),
      ).toBeInTheDocument();
    });
  });
});
