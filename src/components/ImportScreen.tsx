import { useEffect, useRef, useState } from "react";
import { listAccounts, type AccountRow } from "@/lib/accounts";
import { detectFileType, type ImportResult } from "@/lib/import";
import { importOfxFile } from "@/lib/ofx-import";
import { importCsvFile } from "@/lib/csv-import";
import { getInstitutionColumnMapping } from "@/lib/csv-column-mapping";
import { CsvColumnMapperScreen } from "./CsvColumnMapperScreen";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface ImportScreenProps {
  onDone: (result: ImportResult) => void;
  onCancel: () => void;
}

export function ImportScreen({ onDone, onCancel }: ImportScreenProps) {
  const [accounts, setAccounts] = useState<AccountRow[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string>("");
  const [selectedFileName, setSelectedFileName] = useState<string>("");
  const [fileContents, setFileContents] = useState<string>("");
  const [fileTypeError, setFileTypeError] = useState<string>("");
  const [importError, setImportError] = useState<string>("");
  const [isImporting, setIsImporting] = useState(false);
  const [showCsvMapper, setShowCsvMapper] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    listAccounts(false).then(setAccounts);
  }, []);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportError("");
    const fileType = detectFileType(file.name);
    if (fileType === "unknown") {
      setFileTypeError(
        `Unsupported file type ".${file.name.split(".").pop()}". Supported formats: .ofx, .qfx, .csv`,
      );
      setSelectedFileName("");
      setFileContents("");
      return;
    }

    setFileTypeError("");
    setSelectedFileName(file.name);

    const reader = new FileReader();
    reader.onload = (ev) => {
      setFileContents((ev.target?.result as string) ?? "");
    };
    reader.readAsText(file);
  }

  async function handleNext() {
    if (!selectedAccountId || !fileContents) return;

    const fileType = detectFileType(selectedFileName);
    if (fileType === "unknown") return;

    setIsImporting(true);
    setImportError("");

    try {
      let result: ImportResult;
      if (fileType === "ofx") {
        result = await importOfxFile(Number(selectedAccountId), fileContents);
      } else {
        // CSV — check for existing mapping
        if (!selectedAccount) throw new Error("Account not found");
        const mapping = await getInstitutionColumnMapping(
          selectedAccount.institutionId,
        );
        if (!mapping) {
          // No mapping — show mapper screen
          setIsImporting(false);
          setShowCsvMapper(true);
          return;
        }
        // Mapping exists — import directly
        result = await importCsvFile(Number(selectedAccountId), fileContents);
      }
      onDone(result);
    } catch (err) {
      setImportError(String(err instanceof Error ? err.message : err));
    } finally {
      setIsImporting(false);
    }
  }

  const selectedAccount = accounts.find(
    (a) => a.id === Number(selectedAccountId),
  );
  const isApiSyncedAccount = selectedAccount?.isApiSynced === 1;

  const canProceed =
    selectedAccountId !== "" &&
    fileContents !== "" &&
    fileTypeError === "" &&
    !isImporting &&
    !isApiSyncedAccount;

  if (showCsvMapper) {
    if (!selectedAccount) return null;
    return (
      <CsvColumnMapperScreen
        accountId={Number(selectedAccountId)}
        institutionId={selectedAccount.institutionId}
        institutionName={selectedAccount.institutionName}
        fileContents={fileContents}
        onDone={onDone}
        onCancel={() => setShowCsvMapper(false)}
      />
    );
  }

  return (
    <div className="flex h-screen flex-col items-center justify-center">
      <div className="w-full max-w-md rounded-lg border p-6">
        <h1 className="mb-6 text-xl font-semibold">Import Transactions</h1>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium" htmlFor="account-select">
              Account <span className="text-destructive">*</span>
            </label>
            <Select
              value={selectedAccountId}
              onValueChange={setSelectedAccountId}
            >
              <SelectTrigger id="account-select" data-testid="account-select">
                <SelectValue placeholder="Select account" />
              </SelectTrigger>
              <SelectContent>
                {accounts.map((acc) => (
                  <SelectItem key={acc.id} value={String(acc.id)}>
                    {acc.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">
              File <span className="text-destructive">*</span>
            </label>
            <div className="flex items-center gap-2">
              <span
                className="flex-1 truncate rounded-md border px-3 py-2 text-sm text-muted-foreground"
                data-testid="file-name-display"
              >
                {selectedFileName || "No file selected"}
              </span>
              <Button
                type="button"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                data-testid="browse-button"
              >
                Browse…
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".ofx,.qfx,.csv"
                className="hidden"
                onChange={handleFileChange}
                data-testid="file-input"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Supported: .ofx, .qfx, .csv
            </p>
            {fileTypeError && (
              <p
                className="text-sm text-destructive"
                data-testid="file-type-error"
              >
                {fileTypeError}
              </p>
            )}
          </div>

          {isApiSyncedAccount && (
            <p
              className="rounded-md border border-muted bg-muted p-3 text-sm text-muted-foreground"
              data-testid="api-synced-import-warning"
            >
              This account is managed by an API connection. CSV import is
              disabled — use the Settings page to re-sync.
            </p>
          )}

          {importError && (
            <p
              className="rounded-md border border-destructive bg-destructive/10 p-3 text-sm text-destructive"
              data-testid="import-error"
            >
              {importError}
            </p>
          )}
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <Button variant="outline" onClick={onCancel} disabled={isImporting}>
            Cancel
          </Button>
          <Button
            onClick={handleNext}
            disabled={!canProceed}
            data-testid="next-button"
          >
            {isImporting ? "Importing…" : "Next"}
          </Button>
        </div>
      </div>
    </div>
  );
}
