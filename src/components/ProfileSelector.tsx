import { Tag } from "@/lib/reference-data";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const ALL_VALUE = "__all__";

interface ProfileSelectorProps {
  tags: Tag[];
  value: number | null;
  onChange: (tagId: number | null) => void;
}

export function ProfileSelector({ tags, value, onChange }: ProfileSelectorProps) {
  const selectValue = value === null ? ALL_VALUE : String(value);

  function handleChange(v: string) {
    onChange(v === ALL_VALUE ? null : Number(v));
  }

  return (
    <Select value={selectValue} onValueChange={handleChange}>
      <SelectTrigger
        className="h-8 w-36 text-sm"
        aria-label="Profile selector"
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL_VALUE}>All</SelectItem>
        {tags.map((t) => (
          <SelectItem key={t.id} value={String(t.id)}>
            {t.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
