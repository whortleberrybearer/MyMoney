import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { CategoryManagementDialog } from "@/components/CategoryManagementDialog";
import { useTheme, type ThemePreference } from "@/lib/theme-context";

interface SettingsScreenProps {
  filePath: string;
  onSwitchFile: () => void;
  onBack: () => void;
}

export function SettingsScreen({
  filePath,
  onSwitchFile,
  onBack,
}: SettingsScreenProps) {
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const { preference, setThemePreference } = useTheme();

  return (
    <div className="flex h-screen flex-col">
      <header className="flex items-center gap-3 border-b px-6 py-3">
        <Button variant="ghost" size="icon" onClick={onBack} aria-label="Back">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <span className="font-semibold">Settings</span>
      </header>
      <main className="flex flex-col gap-6 p-6 max-w-xl">
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
            Data file
          </h2>
          <p className="break-all rounded bg-muted px-3 py-2 text-sm font-mono">
            {filePath}
          </p>
          <Button
            variant="outline"
            className="w-fit"
            onClick={onSwitchFile}
          >
            Switch data file
          </Button>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
            Appearance
          </h2>
          <p className="text-sm text-muted-foreground">
            Choose how the app looks.
          </p>
          <ToggleGroup
            type="single"
            value={preference}
            onValueChange={(value) => {
              if (value) setThemePreference(value as ThemePreference);
            }}
            className="w-fit"
          >
            <ToggleGroupItem value="light">Light</ToggleGroupItem>
            <ToggleGroupItem value="dark">Dark</ToggleGroupItem>
            <ToggleGroupItem value="system">System</ToggleGroupItem>
          </ToggleGroup>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
            Categories
          </h2>
          <p className="text-sm text-muted-foreground">
            Manage the categories used to classify transactions.
          </p>
          <Button
            variant="outline"
            className="w-fit"
            onClick={() => setCategoryDialogOpen(true)}
            data-testid="manage-categories-btn"
          >
            Manage Categories
          </Button>
        </section>
      </main>

      <CategoryManagementDialog
        open={categoryDialogOpen}
        onOpenChange={setCategoryDialogOpen}
      />
    </div>
  );
}
