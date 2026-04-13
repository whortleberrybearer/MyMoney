import { Button } from "@/components/ui/button";

interface FileNotFoundScreenProps {
  missingPath: string;
  onOpenFile: () => void;
  onCreateFile: () => void;
}

export function FileNotFoundScreen({
  missingPath,
  onOpenFile,
  onCreateFile,
}: FileNotFoundScreenProps) {
  return (
    <div className="flex h-screen flex-col items-center justify-center gap-6 px-8">
      <div className="text-center max-w-md">
        <h1 className="text-2xl font-bold">Data file not found</h1>
        <p className="mt-2 text-muted-foreground">
          The previously used data file could not be found:
        </p>
        <p className="mt-2 break-all rounded bg-muted px-3 py-2 text-sm font-mono">
          {missingPath}
        </p>
        <p className="mt-3 text-sm text-muted-foreground">
          It may have been moved, deleted, or is on a disconnected drive.
        </p>
      </div>
      <div className="flex flex-col gap-3 w-64">
        <Button onClick={onOpenFile} size="lg">
          Open data file
        </Button>
        <Button onClick={onCreateFile} variant="outline" size="lg">
          Create new data file
        </Button>
      </div>
    </div>
  );
}
