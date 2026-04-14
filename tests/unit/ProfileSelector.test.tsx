import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { ProfileSelector } from "@/components/ProfileSelector";
import type { Tag } from "@/lib/reference-data";

// Note: Radix Select dropdown interaction (opening the listbox, clicking items) is not
// supported in jsdom without a full pointer-event implementation. Interaction tests
// are covered by e2e tests. Unit tests here focus on rendered output and accessibility.

const TAGS: Tag[] = [
  { id: 1, name: "Personal" },
  { id: 2, name: "Joint" },
];

beforeEach(() => {
  vi.clearAllMocks();
});

describe("ProfileSelector", () => {
  it("renders 'All' as the displayed value when value is null", () => {
    render(<ProfileSelector tags={TAGS} value={null} onChange={vi.fn()} />);
    const trigger = screen.getByRole("combobox");
    expect(trigger).toHaveTextContent("All");
  });

  it("renders the selected tag name when value is set to an existing tag id", () => {
    render(<ProfileSelector tags={TAGS} value={1} onChange={vi.fn()} />);
    expect(screen.getByRole("combobox")).toHaveTextContent("Personal");
  });

  it("renders the second tag name correctly when value matches the second tag", () => {
    render(<ProfileSelector tags={TAGS} value={2} onChange={vi.fn()} />);
    expect(screen.getByRole("combobox")).toHaveTextContent("Joint");
  });

  it("renders a combobox with aria-label 'Profile selector'", () => {
    render(<ProfileSelector tags={TAGS} value={null} onChange={vi.fn()} />);
    expect(screen.getByRole("combobox", { name: /profile selector/i })).toBeInTheDocument();
  });

  it("renders nothing extra when tags array is empty", () => {
    render(<ProfileSelector tags={[]} value={null} onChange={vi.fn()} />);
    expect(screen.getByRole("combobox")).toHaveTextContent("All");
  });
});
