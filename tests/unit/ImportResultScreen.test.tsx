import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ImportResultScreen } from "@/components/ImportResultScreen";
import type { ImportResult } from "@/lib/import";

const RESULT: ImportResult = {
  total: 42,
  imported: 39,
  duplicateCandidates: 2,
  categorised: 34,
  uncategorised: 5,
  potAllocations: 3,
  allocationFailures: [],
};

describe("ImportResultScreen — counts", () => {
  it("displays all import counts correctly", () => {
    const onDone = vi.fn();
    render(<ImportResultScreen result={RESULT} onDone={onDone} />);

    expect(screen.getByTestId("result-total")).toHaveTextContent("42");
    expect(screen.getByTestId("result-imported")).toHaveTextContent("39");
    expect(screen.getByTestId("result-duplicates")).toHaveTextContent("2");
    expect(screen.getByTestId("result-categorised")).toHaveTextContent("34");
    expect(screen.getByTestId("result-uncategorised")).toHaveTextContent("5");
    expect(screen.getByTestId("result-pot-allocations")).toHaveTextContent("3");
  });

  it("displays zero counts correctly", () => {
    const onDone = vi.fn();
    render(
      <ImportResultScreen
        result={{ total: 0, imported: 0, duplicateCandidates: 0, categorised: 0, uncategorised: 0, potAllocations: 0, allocationFailures: [] }}
        onDone={onDone}
      />,
    );

    expect(screen.getByTestId("result-total")).toHaveTextContent("0");
    expect(screen.getByTestId("result-duplicates")).toHaveTextContent("0");
    expect(screen.getByTestId("result-pot-allocations")).toHaveTextContent("0");
  });
});

describe("ImportResultScreen — allocation failures", () => {
  it("shows allocation failures section when failures exist", () => {
    const onDone = vi.fn();
    render(
      <ImportResultScreen
        result={{
          ...RESULT,
          allocationFailures: [
            { ruleName: "Salary split", potNames: ["Holiday pot"] },
          ],
        }}
        onDone={onDone}
      />,
    );

    const failuresSection = screen.getByTestId("allocation-failures");
    expect(failuresSection).toBeInTheDocument();
    expect(failuresSection).toHaveTextContent("Salary split");
    expect(failuresSection).toHaveTextContent("Holiday pot");
  });

  it("shows multiple failures with their pot names", () => {
    const onDone = vi.fn();
    render(
      <ImportResultScreen
        result={{
          ...RESULT,
          allocationFailures: [
            { ruleName: "Rule A", potNames: ["Holiday pot"] },
            { ruleName: "Rule B", potNames: ["Rainy Day", "Emergency fund"] },
          ],
        }}
        onDone={onDone}
      />,
    );

    const failuresSection = screen.getByTestId("allocation-failures");
    expect(failuresSection).toHaveTextContent("Rule A");
    expect(failuresSection).toHaveTextContent("Rule B");
    expect(failuresSection).toHaveTextContent("Rainy Day");
    expect(failuresSection).toHaveTextContent("Emergency fund");
  });

  it("hides allocation failures section when no failures occurred", () => {
    const onDone = vi.fn();
    render(
      <ImportResultScreen
        result={{ ...RESULT, allocationFailures: [] }}
        onDone={onDone}
      />,
    );

    expect(screen.queryByTestId("allocation-failures")).not.toBeInTheDocument();
  });
});

describe("ImportResultScreen — navigation", () => {
  it("calls onDone when the Done button is clicked", () => {
    const onDone = vi.fn();
    render(<ImportResultScreen result={RESULT} onDone={onDone} />);

    fireEvent.click(screen.getByTestId("done-button"));

    expect(onDone).toHaveBeenCalledOnce();
  });
});
