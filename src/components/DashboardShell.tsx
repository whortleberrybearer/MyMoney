import { useEffect, useState } from "react";
import { ArrowDownToLine, Settings } from "lucide-react";
import { listTags, Tag } from "@/lib/reference-data";
import { Button } from "@/components/ui/button";
import { AccountsScreen } from "./AccountsScreen";
import { ErrorBoundary } from "./ErrorBoundary";
import { ProfileSelector } from "./ProfileSelector";

interface DashboardShellProps {
  onNavigateToSettings: () => void;
  onNavigateToImport: () => void;
  onNavigateToTransactions: (accountId: number, accountName: string) => void;
}

export function DashboardShell({ onNavigateToSettings, onNavigateToImport, onNavigateToTransactions }: DashboardShellProps) {
  const [tags, setTags] = useState<Tag[]>([]);
  const [selectedTagId, setSelectedTagId] = useState<number | null>(null);

  useEffect(() => {
    loadTags();
  }, []);

  async function loadTags() {
    setTags(await listTags());
  }

  function handleTagCreated(newTag: Tag) {
    setTags((prev) => [...prev, newTag].sort((a, b) => a.name.localeCompare(b.name)));
  }

  return (
    <div className="flex h-screen flex-col">
      <header className="flex items-center justify-between border-b px-6 py-3">
        <span className="font-semibold">My Money</span>
        <ProfileSelector
          tags={tags}
          value={selectedTagId}
          onChange={setSelectedTagId}
        />
        <Button
          variant="ghost"
          size="icon"
          onClick={onNavigateToImport}
          aria-label="Import"
          data-testid="import-button"
        >
          <ArrowDownToLine className="h-5 w-5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={onNavigateToSettings}
          aria-label="Settings"
        >
          <Settings className="h-5 w-5" />
        </Button>
      </header>
      <ErrorBoundary>
        <AccountsScreen
          tagId={selectedTagId}
          onTagCreated={handleTagCreated}
          onNavigateToTransactions={onNavigateToTransactions}
        />
      </ErrorBoundary>
    </div>
  );
}
