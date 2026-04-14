import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { TagCombobox } from "@/components/TagCombobox";
import * as refData from "@/lib/reference-data";

vi.mock("@/lib/reference-data", () => ({
  createTag: vi.fn(),
  listTags: vi.fn(),
}));

const mockCreateTag = vi.mocked(refData.createTag);

const TAGS: refData.Tag[] = [
  { id: 1, name: "Personal" },
  { id: 2, name: "Joint" },
];

function openCombobox() {
  const trigger = screen.getByRole("combobox");
  fireEvent.click(trigger);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("TagCombobox", () => {
  it("renders the trigger button showing 'No tag' when value is null", () => {
    render(
      <TagCombobox tags={TAGS} value={null} onChange={vi.fn()} onTagCreated={vi.fn()} />,
    );
    expect(screen.getByRole("combobox")).toHaveTextContent("No tag");
  });

  it("renders the trigger button showing the selected tag name when value is set", () => {
    render(
      <TagCombobox tags={TAGS} value={1} onChange={vi.fn()} onTagCreated={vi.fn()} />,
    );
    expect(screen.getByRole("combobox")).toHaveTextContent("Personal");
  });

  it("renders existing tags in the dropdown when opened", async () => {
    render(
      <TagCombobox tags={TAGS} value={null} onChange={vi.fn()} onTagCreated={vi.fn()} />,
    );
    openCombobox();

    await waitFor(() => {
      expect(screen.getByText("Personal")).toBeInTheDocument();
      expect(screen.getByText("Joint")).toBeInTheDocument();
    });
  });

  it("filters options as the user types", async () => {
    render(
      <TagCombobox tags={TAGS} value={null} onChange={vi.fn()} onTagCreated={vi.fn()} />,
    );
    openCombobox();

    const input = await screen.findByPlaceholderText(/search or create tag/i);
    fireEvent.change(input, { target: { value: "per" } });

    await waitFor(() => {
      expect(screen.getByText("Personal")).toBeInTheDocument();
      expect(screen.queryByText("Joint")).not.toBeInTheDocument();
    });
  });

  it("calls onChange with the tag id when an existing tag is selected", async () => {
    const onChange = vi.fn();
    render(
      <TagCombobox tags={TAGS} value={null} onChange={onChange} onTagCreated={vi.fn()} />,
    );
    openCombobox();

    await waitFor(() => screen.getByText("Personal"));
    fireEvent.click(screen.getByText("Personal"));

    expect(onChange).toHaveBeenCalledWith(1);
  });

  it("shows a Create option when the typed name has no exact match", async () => {
    render(
      <TagCombobox tags={TAGS} value={null} onChange={vi.fn()} onTagCreated={vi.fn()} />,
    );
    openCombobox();

    const input = await screen.findByPlaceholderText(/search or create tag/i);
    fireEvent.change(input, { target: { value: "Family" } });

    await waitFor(() => {
      expect(screen.getByText(/create "family"/i)).toBeInTheDocument();
    });
  });

  it("does not show the Create option when the typed name matches an existing tag exactly", async () => {
    render(
      <TagCombobox tags={TAGS} value={null} onChange={vi.fn()} onTagCreated={vi.fn()} />,
    );
    openCombobox();

    const input = await screen.findByPlaceholderText(/search or create tag/i);
    fireEvent.change(input, { target: { value: "Personal" } });

    await waitFor(() => {
      expect(screen.queryByText(/create "personal"/i)).not.toBeInTheDocument();
    });
  });

  it("calls createTag, onTagCreated, and onChange when Create is selected", async () => {
    const newTag: refData.Tag = { id: 3, name: "Family" };
    mockCreateTag.mockResolvedValue(newTag);
    const onChange = vi.fn();
    const onTagCreated = vi.fn();

    render(
      <TagCombobox
        tags={TAGS}
        value={null}
        onChange={onChange}
        onTagCreated={onTagCreated}
      />,
    );
    openCombobox();

    const input = await screen.findByPlaceholderText(/search or create tag/i);
    fireEvent.change(input, { target: { value: "Family" } });

    await waitFor(() => screen.getByText(/create "family"/i));
    fireEvent.click(screen.getByText(/create "family"/i));

    await waitFor(() => {
      expect(mockCreateTag).toHaveBeenCalledWith("Family");
      expect(onTagCreated).toHaveBeenCalledWith(newTag);
      expect(onChange).toHaveBeenCalledWith(3);
    });
  });

  it("calls onChange with null when the selection is cleared", async () => {
    const onChange = vi.fn();
    render(
      <TagCombobox tags={TAGS} value={1} onChange={onChange} onTagCreated={vi.fn()} />,
    );
    openCombobox();

    await waitFor(() => screen.getByText("No tag"));
    fireEvent.click(screen.getByText("No tag"));

    expect(onChange).toHaveBeenCalledWith(null);
  });
});
