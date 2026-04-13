import { Button } from "@/components/ui/button";

interface MigrationErrorScreenProps {
  filePath: string;
  error: string;
  onReturnToStart: () => void;
}

export function MigrationErrorScreen({
  filePath,
  error,
  onReturnToStart,
}: MigrationErrorScreenProps) {
  return (
    <div className="flex h-screen flex-col items-center justify-center gap-6 px-8">
      <div className="text-center max-w-md">
        <h1 className="text-2xl font-bold">Database migration failed</h1>
        <p className="mt-2 text-muted-foreground">
          The app could not update the data file:
        </p>
        <p className="mt-2 break-all rounded bg-muted px-3 py-2 text-sm font-mono">
          {filePath}
        </p>
        <p className="mt-3 text-sm font-medium text-destructive">
          Error details:
        </p>
        <p className="mt-1 break-all rounded bg-muted px-3 py-2 text-sm font-mono text-destructive">
          {error}
        </p>
      </div>
      <Button onClick={onReturnToStart} size="lg">
        Return to start
      </Button>
    </div>
  );
}
