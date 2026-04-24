import { useEffect, useRef } from "react";
import { AppProvider, useApp } from "@/lib/app-context";
import { ThemeProvider } from "@/lib/theme-context";
import { createNewFile, openExistingFile } from "@/lib/file-selection";
import { runStartupBackup } from "@/lib/file-backup";
import { AppLayout } from "@/components/AppLayout";
import { AccountsOverviewScreen } from "@/components/AccountsOverviewScreen";
import { DashboardShell } from "@/components/DashboardShell";
import { RulesManagementScreen } from "@/components/RulesManagementScreen";
import { FileNotFoundScreen } from "@/components/FileNotFoundScreen";
import { ImportResultScreen } from "@/components/ImportResultScreen";
import { ImportScreen } from "@/components/ImportScreen";
import { LoadingScreen } from "@/components/LoadingScreen";
import { MigrationErrorScreen } from "@/components/MigrationErrorScreen";
import { SettingsScreen } from "@/components/SettingsScreen";
import { TransactionListScreen } from "@/components/TransactionListScreen";
import { PotTransactionListScreen } from "@/components/PotTransactionListScreen";
import { WelcomeScreen } from "@/components/WelcomeScreen";
import "./App.css";

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

function getLayoutActiveScreen(
  screen: string,
): "dashboard" | "accounts-overview" | "settings" {
  if (
    screen === "accounts-overview" ||
    screen === "transaction-list" ||
    screen === "pot-transaction-list"
  ) {
    return "accounts-overview";
  }
  if (screen === "settings") return "settings";
  return "dashboard";
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

    default: {
      const filePath = (current as { filePath: string }).filePath;
      const layoutProps = {
        activeScreen: getLayoutActiveScreen(current.screen),
        onNavigateToDashboard: () => navigate({ screen: "dashboard", filePath }),
        onNavigateToAccountsOverview: () =>
          navigate({ screen: "accounts-overview", filePath }),
        onNavigateToSettings: () => navigate({ screen: "settings", filePath }),
      } as const;

      switch (current.screen) {
        case "dashboard":
          return (
            <AppLayout {...layoutProps}>
              <DashboardShell
                onNavigateToImport={() =>
                  navigate({ screen: "import", filePath })
                }
                onNavigateToTransactions={(accountId, accountName) =>
                  navigate({ screen: "transaction-list", filePath, accountId, accountName })
                }
                onNavigateToPotTransactions={(potId, potName, accountId, accountName) =>
                  navigate({
                    screen: "pot-transaction-list",
                    filePath,
                    potId,
                    potName,
                    accountId,
                    accountName,
                  })
                }
                onNavigateToRules={() => navigate({ screen: "rules", filePath })}
              />
            </AppLayout>
          );

        case "accounts-overview":
          return (
            <AppLayout {...layoutProps}>
              <AccountsOverviewScreen
                onNavigateToTransactions={(accountId, accountName) =>
                  navigate({ screen: "transaction-list", filePath, accountId, accountName })
                }
              />
            </AppLayout>
          );

        case "rules":
          return (
            <AppLayout {...layoutProps}>
              <RulesManagementScreen
                onBack={() => navigate({ screen: "dashboard", filePath })}
              />
            </AppLayout>
          );

        case "transaction-list":
          return (
            <AppLayout {...layoutProps}>
              <TransactionListScreen
                accountId={current.accountId}
                accountName={current.accountName}
                onBack={() =>
                  navigate({ screen: "accounts-overview", filePath })
                }
              />
            </AppLayout>
          );

        case "pot-transaction-list":
          return (
            <AppLayout {...layoutProps}>
              <PotTransactionListScreen
                potId={current.potId}
                potName={current.potName}
                accountId={current.accountId}
                accountName={current.accountName}
                onBack={() =>
                  navigate({ screen: "accounts-overview", filePath })
                }
              />
            </AppLayout>
          );

        case "settings":
          return (
            <AppLayout {...layoutProps}>
              <SettingsScreen
                filePath={filePath}
                onBack={() => navigate({ screen: "dashboard", filePath })}
                onSwitchFile={async () => {
                  const newPath = await openExistingFile(navigate);
                  if (newPath) {
                    navigate({ screen: "dashboard", filePath: newPath });
                  }
                }}
              />
            </AppLayout>
          );

        case "import":
          return (
            <AppLayout {...layoutProps}>
              <ImportScreen
                onDone={(result) =>
                  navigate({ screen: "import-result", filePath, result })
                }
                onCancel={() => navigate({ screen: "dashboard", filePath })}
              />
            </AppLayout>
          );

        case "import-result":
          return (
            <AppLayout {...layoutProps}>
              <ImportResultScreen
                result={current.result}
                onDone={() => navigate({ screen: "dashboard", filePath })}
              />
            </AppLayout>
          );

        default:
          return null;
      }
    }
  }
}

function App() {
  return (
    <ThemeProvider>
      <AppProvider>
        <StartupBackupTrigger />
        <AppScreens />
      </AppProvider>
    </ThemeProvider>
  );
}

export default App;
