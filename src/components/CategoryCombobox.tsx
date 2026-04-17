import { useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { type Category } from "@/lib/categories";
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

const UNCATEGORISED_VALUE = "__uncategorised__";

interface CategoryComboboxProps {
  id?: string;
  categories: Category[];
  /** The selected category id, or null for Uncategorised */
  value: number | null;
  onChange: (categoryId: number | null) => void;
  disabled?: boolean;
}

export function CategoryCombobox({
  id,
  categories,
  value,
  onChange,
  disabled,
}: CategoryComboboxProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const selectedCategory = categories.find((c) => c.id === value) ?? null;
  const displayLabel = selectedCategory?.name ?? "Uncategorised";
  const isUncategorised = value === null;

  // Uncategorised is always present as the first entry; exclude it from the
  // rest of the list (it's shown separately at the top).
  const otherCategories = categories.filter((c) => !c.isSystem);

  const filtered = query
    ? otherCategories.filter((c) =>
        c.name.toLowerCase().includes(query.toLowerCase()),
      )
    : otherCategories;

  const showUncategorised =
    !query || "uncategorised".includes(query.toLowerCase());

  function handleSelect(categoryId: number | null) {
    onChange(categoryId);
    setOpen(false);
    setQuery("");
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className="w-full justify-between font-normal"
          data-testid={id ?? "category-combobox"}
        >
          <span
            className={cn(
              "truncate",
              isUncategorised && "text-muted-foreground",
            )}
          >
            {displayLabel}
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
            placeholder="Search categories..."
            value={query}
            onValueChange={setQuery}
          />
          <CommandList>
            <CommandEmpty>No categories found.</CommandEmpty>
            <CommandGroup>
              {showUncategorised && (
                <CommandItem
                  value={UNCATEGORISED_VALUE}
                  onSelect={() => handleSelect(null)}
                  data-testid="category-option-uncategorised"
                >
                  <span className="text-muted-foreground">Uncategorised</span>
                  {isUncategorised && <Check className="ml-auto h-4 w-4" />}
                </CommandItem>
              )}
              {filtered.map((c) => (
                <CommandItem
                  key={c.id}
                  value={String(c.id)}
                  onSelect={() => handleSelect(c.id)}
                  data-testid={`category-option-${c.id}`}
                >
                  {c.name}
                  {value === c.id && <Check className="ml-auto h-4 w-4" />}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
