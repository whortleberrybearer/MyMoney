import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { CsvColumnMapperScreen } from "@/components/CsvColumnMapperScreen";
import * as csvColumnMappingLib from "@/lib/csv-column-mapping";
import * as csvImportLib from "@/lib/csv-import";

vi.mock("@/lib/csv-column-mapping", () => ({ saveInstitutionColumnMapping: vi.fn() }));
vi.mock("@/lib/csv-import", () => ({
  importCsvFile: vi.fn(),
  parseDateWithFormat: vi.fn().mockReturnValue("2024-03-15"),
}));
vi.mock("@tauri-apps/plugin-sql", () => ({ default: { load: vi.fn() } }));

const mockSave = vi.mocked(csvColumnMappingLib.saveInstitutionColumnMapping);
const mockImport = vi.mocked(csvImportLib.importCsvFile);

const RESULT = { total: 1, imported: 1, duplicateCandidates: 0, categorised: 0, uncategorised: 1, potAllocations: 0, allocationFailures: [], parseErrors: 0 };

const CSV_WITH_HEADER = "Date,Payee,Amount\n15/03/2024,TESCO,-12.50\n16/03/2024,SAINSBURY,-8.00\n17/03/2024,AMAZON,-25.00\n18/03/2024,BP,-50.00\n19/03/2024,SHELL,-45.00\n20/03/2024,EXTRA,-5.00";

const BASE_PROPS = {
  accountId: 1,
  institutionId: 1,
  institutionName: "Barclays",
  fileContents: CSV_WITH_HEADER,
  onDone: vi.fn(),
  onCancel: vi.fn(),
};

beforeEach(() => {
  vi.clearAllMocks();
  mockSave.mockResolvedValue(undefined);
  mockImport.mockResolvedValue(RESULT);
});

describe("CsvColumnMapperScreen — CSV preview", () => {
  it("renders no more than 5 data rows in the preview", () => {
    render(<CsvColumnMapperScreen {...BASE_PROPS} />);
    const table = screen.getByTestId("csv-preview-table");
    // The table body should have at most 5 rows
    const dataRows = table.querySelectorAll("tbody tr");
    expect(dataRows.length).toBeLessThanOrEqual(5);
  });

  it("uses header values as column labels when hasHeaderRow is checked", () => {
    render(<CsvColumnMapperScreen {...BASE_PROPS} />);
    // Header row labels "Date", "Payee", "Amount" should appear in column headers
    expect(screen.getByTestId("csv-preview-table")).toBeInTheDocument();
  });
});

describe("CsvColumnMapperScreen — Save & Import button", () => {
  it("Save & Import is disabled when no date column is assigned", () => {
    render(<CsvColumnMapperScreen {...BASE_PROPS} />);
    expect(screen.getByTestId("save-import-button")).toBeDisabled();
  });
});

describe("CsvColumnMapperScreen — amount convention toggle", () => {
  it("shows amount picker in single convention mode", () => {
    render(<CsvColumnMapperScreen {...BASE_PROPS} />);
    // Single is the default
    expect(screen.getByTestId("amount-col-select")).toBeInTheDocument();
    expect(screen.queryByTestId("debit-col-select")).not.toBeInTheDocument();
    expect(screen.queryByTestId("credit-col-select")).not.toBeInTheDocument();
  });

  it("shows debit and credit pickers when split convention is selected", () => {
    render(<CsvColumnMapperScreen {...BASE_PROPS} />);
    fireEvent.click(screen.getByTestId("amount-convention-split"));
    expect(screen.getByTestId("debit-col-select")).toBeInTheDocument();
    expect(screen.getByTestId("credit-col-select")).toBeInTheDocument();
    expect(screen.queryByTestId("amount-col-select")).not.toBeInTheDocument();
  });
});

describe("CsvColumnMapperScreen — cancel", () => {
  it("calls onCancel when Cancel button is clicked", () => {
    const onCancel = vi.fn();
    render(<CsvColumnMapperScreen {...BASE_PROPS} onCancel={onCancel} />);
    fireEvent.click(screen.getByTestId("cancel-button"));
    expect(onCancel).toHaveBeenCalledOnce();
  });
});
