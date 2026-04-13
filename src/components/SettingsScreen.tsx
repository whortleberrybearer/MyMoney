import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

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
      </main>
    </div>
  );
}
