import { Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AccountsScreen } from "./AccountsScreen";
import { ErrorBoundary } from "./ErrorBoundary";

interface DashboardShellProps {
  onNavigateToSettings: () => void;
}

export function DashboardShell({ onNavigateToSettings }: DashboardShellProps) {
  return (
    <div className="flex h-screen flex-col">
      <header className="flex items-center justify-between border-b px-6 py-3">
        <span className="font-semibold">My Money</span>
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
        <AccountsScreen />
      </ErrorBoundary>
    </div>
  );
}
