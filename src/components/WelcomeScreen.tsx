import { Button } from "@/components/ui/button";

interface WelcomeScreenProps {
  onCreateFile: () => void;
  onOpenFile: () => void;
}

export function WelcomeScreen({ onCreateFile, onOpenFile }: WelcomeScreenProps) {
  return (
    <div className="flex h-screen flex-col items-center justify-center gap-8">
      <div className="text-center">
        <h1 className="text-4xl font-bold tracking-tight">My Money</h1>
        <p className="mt-2 text-muted-foreground">
          Track your finances with a local data file
        </p>
      </div>
      <div className="flex flex-col gap-3 w-64">
        <Button onClick={onCreateFile} size="lg">
          Create new data file
        </Button>
        <Button onClick={onOpenFile} variant="outline" size="lg">
          Open existing data file
        </Button>
      </div>
    </div>
  );
}
