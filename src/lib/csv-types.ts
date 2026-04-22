export type ColumnMapping = {
  columns: {
    date: number | null;
    payee: number | null;
    notes: number | null;
    amount: number | null;
    debit: number | null;
    credit: number | null;
    balance: number | null;
    reference: number | null;
  };
  amountConvention: "single" | "split";
  dateFormat: string;
  hasHeaderRow: boolean;
};

export const SUPPORTED_DATE_FORMATS = [
  "dd/MM/yyyy",
  "MM/dd/yyyy",
  "yyyy-MM-dd",
  "d/M/yyyy",
  "M/d/yyyy",
  "dd-MM-yyyy",
  "dd MMM yyyy",
  "yyyy/MM/dd",
] as const;

export type SupportedDateFormat = (typeof SUPPORTED_DATE_FORMATS)[number];
