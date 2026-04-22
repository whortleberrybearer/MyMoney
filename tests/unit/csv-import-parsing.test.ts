import { describe, it, expect } from "vitest";
import { parseDateWithFormat } from "@/lib/csv-import";

describe("parseDateWithFormat", () => {
  it("parses dd/MM/yyyy", () => {
    expect(parseDateWithFormat("15/03/2024", "dd/MM/yyyy")).toBe("2024-03-15");
  });
  it("parses MM/dd/yyyy", () => {
    expect(parseDateWithFormat("03/15/2024", "MM/dd/yyyy")).toBe("2024-03-15");
  });
  it("parses yyyy-MM-dd", () => {
    expect(parseDateWithFormat("2024-03-15", "yyyy-MM-dd")).toBe("2024-03-15");
  });
  it("parses d/M/yyyy (variable-width)", () => {
    expect(parseDateWithFormat("5/3/2024", "d/M/yyyy")).toBe("2024-03-05");
  });
  it("parses M/d/yyyy (variable-width)", () => {
    expect(parseDateWithFormat("3/5/2024", "M/d/yyyy")).toBe("2024-03-05");
  });
  it("parses dd-MM-yyyy", () => {
    expect(parseDateWithFormat("15-03-2024", "dd-MM-yyyy")).toBe("2024-03-15");
  });
  it("parses dd MMM yyyy", () => {
    expect(parseDateWithFormat("15 Mar 2024", "dd MMM yyyy")).toBe("2024-03-15");
  });
  it("parses yyyy/MM/dd", () => {
    expect(parseDateWithFormat("2024/03/15", "yyyy/MM/dd")).toBe("2024-03-15");
  });
  it("returns null for invalid date string", () => {
    expect(parseDateWithFormat("not-a-date", "dd/MM/yyyy")).toBeNull();
  });
  it("returns null for empty string", () => {
    expect(parseDateWithFormat("", "dd/MM/yyyy")).toBeNull();
  });
  it("returns null for unknown format", () => {
    expect(parseDateWithFormat("15/03/2024", "unknown")).toBeNull();
  });
});
