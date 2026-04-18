import type { ImportResult } from "@/lib/import";
import { Button } from "@/components/ui/button";

interface ImportResultScreenProps {
  result: ImportResult;
  onDone: () => void;
}

export function ImportResultScreen({ result, onDone }: ImportResultScreenProps) {
  return (
    <div className="flex h-screen flex-col items-center justify-center">
      <div className="w-full max-w-md rounded-lg border p-6">
        <h1 className="mb-2 text-xl font-semibold">Import Complete</h1>
        <p className="mb-6 text-sm text-muted-foreground">Import finished</p>

        <div className="space-y-2 rounded-md border p-4 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Total rows</span>
            <span data-testid="result-total">{result.total}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Imported</span>
            <span data-testid="result-imported">{result.imported}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Duplicate candidates</span>
            <span data-testid="result-duplicates">{result.duplicateCandidates}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Categorised</span>
            <span data-testid="result-categorised">{result.categorised}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Uncategorised</span>
            <span data-testid="result-uncategorised">{result.uncategorised}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Pot allocations</span>
            <span data-testid="result-pot-allocations">{result.potAllocations}</span>
          </div>
        </div>

        {result.allocationFailures.length > 0 && (
          <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-4 text-sm dark:border-amber-800 dark:bg-amber-950" data-testid="allocation-failures">
            <p className="mb-2 font-medium text-amber-800 dark:text-amber-200">
              Allocation failures ({result.allocationFailures.length})
            </p>
            <ul className="space-y-1 text-amber-700 dark:text-amber-300">
              {result.allocationFailures.map((failure, i) => (
                <li key={i}>
                  Rule &apos;{failure.ruleName}&apos; — insufficient balance for{" "}
                  {failure.potNames.join(", ")}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-6 flex justify-end">
          <Button onClick={onDone} data-testid="done-button">
            Done
          </Button>
        </div>
      </div>
    </div>
  );
}
