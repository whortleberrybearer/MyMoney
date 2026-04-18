/**
 * Shared types and utilities for the transaction import pipeline.
 * Both OFX and CSV import handlers produce an ImportResult.
 */

export type AllocationFailure = {
  ruleName: string;
  potNames: string[];
};

export type ImportResult = {
  total: number;
  imported: number;
  duplicateCandidates: number;
  categorised: number;
  uncategorised: number;
  potAllocations: number;
  allocationFailures: AllocationFailure[];
};

/**
 * Detect the import file type from its filename extension.
 * Returns "ofx" for .ofx and .qfx, "csv" for .csv, "unknown" otherwise.
 */
export function detectFileType(filename: string): "ofx" | "csv" | "unknown" {
  const ext = filename.toLowerCase().split(".").pop();
  if (ext === "ofx" || ext === "qfx") return "ofx";
  if (ext === "csv") return "csv";
  return "unknown";
}
