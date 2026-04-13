import { useEffect, useRef } from "react";
import { AppProvider, useApp } from "@/lib/app-context";
import { createNewFile, openExistingFile } from "@/lib/file-selection";
import { runStartupBackup } from "@/lib/file-backup";
import { DashboardShell } from "@/components/DashboardShell";
import { FileNotFoundScreen } from "@/components/FileNotFoundScreen";
import { LoadingScreen } from "@/components/LoadingScreen";
import { MigrationErrorScreen } from "@/components/MigrationErrorScreen";
import { SettingsScreen } from "@/components/SettingsScreen";
import { WelcomeScreen } from "@/components/WelcomeScreen";
import "./App.css";

/**
 * Fires the startup backup once when the app first routes to the dashboard
 * from a previously stored file path. Non-blocking.
 */
function StartupBackupTrigger() {
  const { current } = useApp();
  const firedRef = useRef(false);

  useEffect(() => {
    if (current.screen === "dashboard" && !firedRef.current) {
      firedRef.current = true;
      runStartupBackup(current.filePath);
    }
  }, [current]);

  return null;
}

function AppScreens() {
  const { current, navigate } = useApp();

  async function handleCreateFile() {
    const filePath = await createNewFile();
    if (filePath) {
      navigate({ screen: "dashboard", filePath });
    }
  }

  async function handleOpenFile() {
    const filePath = await openExistingFile(navigate);
    if (filePath) {
      navigate({ screen: "dashboard", filePath });
    }
  }

  switch (current.screen) {
    case "loading":
      return <LoadingScreen />;

    case "welcome":
      return (
        <WelcomeScreen
          onCreateFile={handleCreateFile}
          onOpenFile={handleOpenFile}
        />
      );

    case "file-not-found":
      return (
        <FileNotFoundScreen
          missingPath={current.missingPath}
          onOpenFile={handleOpenFile}
          onCreateFile={handleCreateFile}
        />
      );

    case "migration-error":
      return (
        <MigrationErrorScreen
          filePath={current.filePath}
          error={current.error}
          onReturnToStart={() => navigate({ screen: "welcome" })}
        />
      );

    case "dashboard":
      return (
        <DashboardShell
          onNavigateToSettings={() =>
            navigate({ screen: "settings", filePath: current.filePath })
          }
        />
      );

    case "settings":
      return (
        <SettingsScreen
          filePath={current.filePath}
          onBack={() =>
            navigate({ screen: "dashboard", filePath: current.filePath })
          }
          onSwitchFile={async () => {
            const filePath = await openExistingFile(navigate);
            if (filePath) {
              navigate({ screen: "dashboard", filePath });
            }
          }}
        />
      );
  }
}

function App() {
  return (
    <AppProvider>
      <StartupBackupTrigger />
      <AppScreens />
    </AppProvider>
  );
}

export default App;
