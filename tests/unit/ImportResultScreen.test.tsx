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
  });

  it("displays zero counts correctly", () => {
    const onDone = vi.fn();
    render(
      <ImportResultScreen
        result={{ total: 0, imported: 0, duplicateCandidates: 0, categorised: 0, uncategorised: 0 }}
        onDone={onDone}
      />,
    );

    expect(screen.getByTestId("result-total")).toHaveTextContent("0");
    expect(screen.getByTestId("result-duplicates")).toHaveTextContent("0");
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
