import { useState } from "react";
import { Check, ChevronsUpDown, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { createTag, Tag } from "@/lib/reference-data";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface TagComboboxProps {
  id?: string;
  tags: Tag[];
  value: number | null;
  onChange: (tagId: number | null) => void;
  onTagCreated: (tag: Tag) => void;
}

export function TagCombobox({
  id,
  tags,
  value,
  onChange,
  onTagCreated,
}: TagComboboxProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");

  const selectedTag = tags.find((t) => t.id === value) ?? null;

  const filtered = query
    ? tags.filter((t) => t.name.toLowerCase().includes(query.toLowerCase()))
    : tags;

  const hasExactMatch = tags.some(
    (t) => t.name.toLowerCase() === query.toLowerCase(),
  );

  async function handleCreate() {
    if (!query.trim() || creating) return;
    setCreating(true);
    setCreateError("");
    try {
      const newTag = await createTag(query.trim());
      onTagCreated(newTag);
      onChange(newTag.id);
      setOpen(false);
      setQuery("");
    } catch (err) {
      setCreateError(String(err).replace("Error: ", ""));
    } finally {
      setCreating(false);
    }
  }

  function handleSelect(tagId: number) {
    onChange(tagId === value ? null : tagId);
    setOpen(false);
    setQuery("");
  }

  return (
    <div className="flex flex-col gap-1">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id={id}
            variant="outline"
            role="combobox"
            aria-expanded={open}
            aria-label={id ? undefined : "Select or create tag"}
            className="w-full justify-between font-normal"
          >
            <span
              className={cn(
                "truncate",
                !selectedTag && "text-muted-foreground",
              )}
            >
              {selectedTag ? selectedTag.name : "No tag"}
            </span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="w-[--radix-popover-trigger-width] p-0"
          align="start"
        >
          <Command shouldFilter={false}>
            <CommandInput
              placeholder="Search or create tag..."
              value={query}
              onValueChange={setQuery}
            />
            <CommandList>
              {filtered.length === 0 && !query && (
                <CommandEmpty>No tags found.</CommandEmpty>
              )}
              <CommandGroup>
                {selectedTag && (
                  <CommandItem
                    value="__clear__"
                    onSelect={() => {
                      onChange(null);
                      setOpen(false);
                      setQuery("");
                    }}
                  >
                    <span className="text-muted-foreground">No tag</span>
                    {value === null && <Check className="ml-auto h-4 w-4" />}
                  </CommandItem>
                )}
                {filtered.map((t) => (
                  <CommandItem
                    key={t.id}
                    value={String(t.id)}
                    onSelect={() => handleSelect(t.id)}
                  >
                    {t.name}
                    {value === t.id && <Check className="ml-auto h-4 w-4" />}
                  </CommandItem>
                ))}
                {query.trim() && !hasExactMatch && (
                  <CommandItem
                    value="__create__"
                    onSelect={handleCreate}
                    disabled={creating}
                  >
                    <Plus className="h-4 w-4 opacity-60" />
                    {creating
                      ? `Creating "${query.trim()}"…`
                      : `Create "${query.trim()}"`}
                  </CommandItem>
                )}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {createError && <p className="text-xs text-destructive">{createError}</p>}
    </div>
  );
}
