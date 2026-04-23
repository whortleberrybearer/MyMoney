import { useEffect, useMemo, useState } from "react";
import Papa from "papaparse";
import { ColumnMapping, SUPPORTED_DATE_FORMATS } from "@/lib/csv-types";
import { saveInstitutionColumnMapping } from "@/lib/csv-column-mapping";
import { importCsvFile, parseDateWithFormat } from "@/lib/csv-import";
import type { ImportResult } from "@/lib/import";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface CsvColumnMapperScreenProps {
  accountId: number;
  institutionId: number;
  institutionName: string;
  fileContents: string;
  onDone: (result: ImportResult) => void;
  onCancel: () => void;
}

export function CsvColumnMapperScreen({
  accountId,
  institutionId,
  institutionName,
  fileContents,
  onDone,
  onCancel,
}: CsvColumnMapperScreenProps) {
  const [hasHeaderRow, setHasHeaderRow] = useState(true);
  const [amountConvention, setAmountConvention] = useState<"single" | "split">(
    "single",
  );
  const [dateCol, setDateCol] = useState<number | null>(null);
  const [dateFormat, setDateFormat] = useState<string>("");
  const [payeeCol, setPayeeCol] = useState<number | null>(null);
  const [notesCol, setNotesCol] = useState<number | null>(null);
  const [referenceCol, setReferenceCol] = useState<number | null>(null);
  const [amountCol, setAmountCol] = useState<number | null>(null);
  const [debitCol, setDebitCol] = useState<number | null>(null);
  const [creditCol, setCreditCol] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string>("");

  const parsed = useMemo(
    () => Papa.parse<string[]>(fileContents, { skipEmptyLines: true }),
    [fileContents],
  );
  const allRows = parsed.data;
  const headerRow = hasHeaderRow ? allRows[0] : null;
  const dataRows = hasHeaderRow ? allRows.slice(1, 6) : allRows.slice(0, 5);
  const columnCount = allRows[0]?.length ?? 0;
  const colLabels = headerRow
    ? headerRow
    : Array.from({ length: columnCount }, (_, i) => `Col ${i}`);

  function findHeaderIndex(candidates: string[]): number | null {
    if (!headerRow) return null;
    const normalized = headerRow.map((h) =>
      String(h ?? "")
        .trim()
        .toLowerCase(),
    );
    for (const candidate of candidates) {
      const idx = normalized.findIndex((h) => h === candidate);
      if (idx >= 0) return idx;
    }
    return null;
  }

  // UX: when the CSV has headers, default the Payee mapping if present.
  // This keeps duplicate detection useful without forcing the user to map it.
  useEffect(() => {
    if (!hasHeaderRow) return;
    if (payeeCol !== null) return;
    const idx = findHeaderIndex(["payee", "merchant", "description", "name"]);
    if (idx !== null) setPayeeCol(idx);
  }, [hasHeaderRow, headerRow, payeeCol]);

  function colOptions(includeIgnore = true) {
    const opts = colLabels.map((label, i) => ({ value: String(i), label }));
    return includeIgnore ? [{ value: "-1", label: "Ignore" }, ...opts] : opts;
  }

  function colValue(col: number | null) {
    return col === null ? "-1" : String(col);
  }

  function onColChange(setter: (v: number | null) => void) {
    return (v: string) => setter(v === "-1" ? null : Number(v));
  }

  const datePreview = useMemo(() => {
    if (dateCol === null || !dateFormat || dataRows.length === 0) return null;
    const raw = dataRows[0]?.[dateCol] ?? "";
    const result = parseDateWithFormat(raw, dateFormat);
    return result ? result : "Cannot parse date with this format";
  }, [dateCol, dateFormat, dataRows]);

  const canSave =
    dateCol !== null &&
    dateFormat !== "" &&
    (amountConvention === "single"
      ? amountCol !== null
      : debitCol !== null && creditCol !== null) &&
    !isSaving;

  async function handleSave() {
    if (!canSave) return;
    setIsSaving(true);
    setError("");
    try {
      const mapping: ColumnMapping = {
        columns: {
          date: dateCol,
          payee: payeeCol,
          notes: notesCol,
          amount: amountConvention === "single" ? amountCol : null,
          debit: amountConvention === "split" ? debitCol : null,
          credit: amountConvention === "split" ? creditCol : null,
          balance: null,
          reference: referenceCol,
        },
        amountConvention,
        dateFormat,
        hasHeaderRow,
      };
      await saveInstitutionColumnMapping(institutionId, mapping);
      const result = await importCsvFile(accountId, fileContents);
      onDone(result);
    } catch (err) {
      setError(String(err instanceof Error ? err.message : err));
    } finally {
      setIsSaving(false);
    }
  }

  const colOpts = colOptions();

  function ColSelect({
    value,
    onChange,
    testId,
  }: {
    value: number | null;
    onChange: (v: string) => void;
    testId: string;
  }) {
    return (
      <Select value={colValue(value)} onValueChange={onChange}>
        <SelectTrigger className="w-full" data-testid={testId}>
          <SelectValue placeholder="Select column" />
        </SelectTrigger>
        <SelectContent>
          {colOpts.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-start py-8">
      <div className="w-full max-w-3xl rounded-lg border p-6">
        <h1 className="mb-1 text-xl font-semibold">Map CSV Columns</h1>
        <p className="mb-6 text-sm text-muted-foreground">
          Configure column mapping for{" "}
          <span className="font-medium">{institutionName}</span>
        </p>

        <div className="space-y-6">
          {/* Header row checkbox */}
          <div>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={hasHeaderRow}
                onChange={(e) => setHasHeaderRow(e.target.checked)}
                data-testid="has-header-row-checkbox"
              />
              CSV has header row?
            </label>
          </div>

          {/* CSV Preview table */}
          <div>
            <h2 className="mb-2 text-sm font-medium">CSV Preview</h2>
            <div className="overflow-x-auto rounded-md border">
              <table
                className="min-w-full text-sm"
                data-testid="csv-preview-table"
              >
                <thead>
                  <tr className="bg-muted/50">
                    {colLabels.map((label, i) => (
                      <th
                        key={i}
                        className="border-b px-3 py-2 text-left font-medium text-muted-foreground"
                      >
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {dataRows.map((row, ri) => (
                    <tr key={ri} className="border-b last:border-0">
                      {row.map((cell, ci) => (
                        <td key={ci} className="px-3 py-2">
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                  {dataRows.length === 0 && (
                    <tr>
                      <td
                        colSpan={columnCount || 1}
                        className="px-3 py-4 text-center text-muted-foreground"
                      >
                        No data rows
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Column assignments */}
          <div>
            <h2 className="mb-3 text-sm font-medium">Column Assignments</h2>
            <div className="grid grid-cols-2 gap-4">
              {/* Date column */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium">
                  Date <span className="text-destructive">*</span>
                </label>
                <ColSelect
                  value={dateCol}
                  onChange={onColChange(setDateCol)}
                  testId="date-col-select"
                />
              </div>

              {/* Date format */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium">
                  Date Format <span className="text-destructive">*</span>
                </label>
                <Select value={dateFormat} onValueChange={setDateFormat}>
                  <SelectTrigger
                    className="w-full"
                    data-testid="date-format-select"
                  >
                    <SelectValue placeholder="Select format" />
                  </SelectTrigger>
                  <SelectContent>
                    {SUPPORTED_DATE_FORMATS.map((fmt) => (
                      <SelectItem key={fmt} value={fmt}>
                        {fmt}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Payee column */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Payee</label>
                <ColSelect
                  value={payeeCol}
                  onChange={onColChange(setPayeeCol)}
                  testId="payee-col-select"
                />
              </div>

              {/* Notes column */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Notes</label>
                <ColSelect
                  value={notesCol}
                  onChange={onColChange(setNotesCol)}
                  testId="notes-col-select"
                />
              </div>

              {/* Reference column */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Reference</label>
                <ColSelect
                  value={referenceCol}
                  onChange={onColChange(setReferenceCol)}
                  testId="reference-col-select"
                />
              </div>
            </div>
          </div>

          {/* Date preview */}
          {datePreview !== null && (
            <div className="rounded-md bg-muted/50 px-3 py-2 text-sm">
              <span className="font-medium">Date preview: </span>
              <span data-testid="date-preview">{datePreview}</span>
            </div>
          )}

          {/* Amount convention */}
          <div>
            <h2 className="mb-2 text-sm font-medium">
              Amount Convention <span className="text-destructive">*</span>
            </h2>
            <div className="flex flex-col gap-2">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="radio"
                  value="single"
                  checked={amountConvention === "single"}
                  onChange={() => setAmountConvention("single")}
                  data-testid="amount-convention-single"
                />
                Single column (positive = credit, negative = debit)
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="radio"
                  value="split"
                  checked={amountConvention === "split"}
                  onChange={() => setAmountConvention("split")}
                  data-testid="amount-convention-split"
                />
                Separate debit / credit columns
              </label>
            </div>
          </div>

          {/* Amount column selects (conditional) */}
          <div className="grid grid-cols-2 gap-4">
            {amountConvention === "single" ? (
              <div className="space-y-1.5">
                <label className="text-sm font-medium">
                  Amount <span className="text-destructive">*</span>
                </label>
                <ColSelect
                  value={amountCol}
                  onChange={onColChange(setAmountCol)}
                  testId="amount-col-select"
                />
              </div>
            ) : (
              <>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">
                    Debit <span className="text-destructive">*</span>
                  </label>
                  <ColSelect
                    value={debitCol}
                    onChange={onColChange(setDebitCol)}
                    testId="debit-col-select"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">
                    Credit <span className="text-destructive">*</span>
                  </label>
                  <ColSelect
                    value={creditCol}
                    onChange={onColChange(setCreditCol)}
                    testId="credit-col-select"
                  />
                </div>
              </>
            )}
          </div>

          {/* Error message */}
          {error && (
            <p
              className="rounded-md border border-destructive bg-destructive/10 p-3 text-sm text-destructive"
              data-testid="mapper-error"
            >
              {error}
            </p>
          )}
        </div>

        {/* Action buttons */}
        <div className="mt-6 flex justify-end gap-2">
          <Button
            variant="outline"
            onClick={onCancel}
            disabled={isSaving}
            data-testid="cancel-button"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={!canSave}
            data-testid="save-import-button"
          >
            {isSaving ? "Saving…" : "Save & Import"}
          </Button>
        </div>
      </div>
    </div>
  );
}
