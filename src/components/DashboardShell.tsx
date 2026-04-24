import { useEffect, useState } from "react";
import { ArrowDownToLine, Tags } from "lucide-react";
import { listTags, Tag } from "@/lib/reference-data";
import { Button } from "@/components/ui/button";
import { TopBar } from "@/components/AppLayout";
import { AccountsScreen } from "./AccountsScreen";
import { ErrorBoundary } from "./ErrorBoundary";
import { ProfileSelector } from "./ProfileSelector";

interface DashboardShellProps {
  onNavigateToImport: () => void;
  onNavigateToTransactions: (accountId: number, accountName: string) => void;
  onNavigateToPotTransactions: (potId: number, potName: string, accountId: number, accountName: string) => void;
  onNavigateToRules: () => void;
}

export function DashboardShell({ onNavigateToImport, onNavigateToTransactions, onNavigateToPotTransactions, onNavigateToRules }: DashboardShellProps) {
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
    <div className="flex h-full flex-col">
      <TopBar title="Dashboard" />
      <div className="flex items-center gap-2 border-b px-5 py-2" style={{ borderColor: "var(--ds-border)", background: "var(--ds-surface)" }}>
        <ProfileSelector
          tags={tags}
          value={selectedTagId}
          onChange={setSelectedTagId}
        />
        <div className="flex-1" />
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
          onClick={onNavigateToRules}
          aria-label="Rules"
          data-testid="rules-nav-button"
        >
          <Tags className="h-5 w-5" />
        </Button>
      </div>
      <ErrorBoundary>
        <AccountsScreen
          tagId={selectedTagId}
          onTagCreated={handleTagCreated}
          onNavigateToTransactions={onNavigateToTransactions}
          onNavigateToPotTransactions={onNavigateToPotTransactions}
        />
      </ErrorBoundary>
    </div>
  );
}
