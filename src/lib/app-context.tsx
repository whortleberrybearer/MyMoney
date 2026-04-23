import { invoke } from "@tauri-apps/api/core";
import { openDb } from "./db";
import { syncAllConnections, type SyncProgress } from "./api-sync";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

// ---------------------------------------------------------------------------
// AppScreen state machine
// ---------------------------------------------------------------------------

export type AppScreen =
  | { screen: "loading" }
  | { screen: "welcome" }
  | { screen: "file-not-found"; missingPath: string }
  | { screen: "migration-error"; filePath: string; error: string }
  | { screen: "dashboard"; filePath: string }
  | { screen: "settings"; filePath: string }
  | { screen: "import"; filePath: string }
  | { screen: "import-result"; filePath: string; result: import("./import").ImportResult }
  | { screen: "transaction-list"; filePath: string; accountId: number; accountName: string }
  | { screen: "pot-transaction-list"; filePath: string; potId: number; potName: string; accountId: number; accountName: string }
  | { screen: "rules"; filePath: string };

// ---------------------------------------------------------------------------
// AppContext
// ---------------------------------------------------------------------------

const LAST_OPENED_KEY = "lastOpenedFilePath";

interface AppContextValue {
  current: AppScreen;
  navigate: (next: AppScreen) => void;
  syncProgress: SyncProgress[];
  syncErrors: string[];
}

const AppContext = createContext<AppContextValue | null>(null);

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}

// ---------------------------------------------------------------------------
// useStartupRouting
// ---------------------------------------------------------------------------

function useStartupRouting(
  setCurrent: (screen: AppScreen) => void,
  setSyncProgress: (fn: (prev: SyncProgress[]) => SyncProgress[]) => void,
  setSyncErrors: (fn: (prev: string[]) => string[]) => void,
): void {
  useEffect(() => {
    let cancelled = false;

    async function route() {
      try {
        const storedPath = localStorage.getItem(LAST_OPENED_KEY);

        if (!storedPath) {
          if (!cancelled) setCurrent({ screen: "welcome" });
          return;
        }

        const fileExists = await invoke<boolean>("file_exists", { path: storedPath });

        if (cancelled) return;

        if (fileExists) {
          try {
            await openDb(storedPath);
          } catch (err) {
            if (!cancelled) {
              setCurrent({
                screen: "migration-error",
                filePath: storedPath,
                error: String(err),
              });
            }
            return;
          }
          if (!cancelled) {
            setCurrent({ screen: "dashboard", filePath: storedPath });
            // Fire-and-forget startup sync — failures must not block navigation
            syncAllConnections((progress) => {
              setSyncProgress((prev) => {
                const idx = prev.findIndex(
                  (p) => p.connectionId === progress.connectionId && p.accountName === progress.accountName,
                );
                if (idx >= 0) {
                  const updated = [...prev];
                  updated[idx] = progress;
                  return updated;
                }
                return [...prev, progress];
              });
              if (progress.error) {
                setSyncErrors((prev) => [
                  ...prev,
                  `Sync failed for ${progress.accountName}: ${progress.error}`,
                ]);
              }
            }).catch((err) => {
              setSyncErrors((prev) => [...prev, `Startup sync error: ${String(err)}`]);
            });
          }
        } else {
          setCurrent({ screen: "file-not-found", missingPath: storedPath });
        }
      } catch (err) {
        console.error("[startup] routing error:", err);
        if (!cancelled) setCurrent({ screen: "welcome" });
      }
    }

    route();
    return () => {
      cancelled = true;
    };
  }, [setCurrent]);
}

// ---------------------------------------------------------------------------
// AppProvider
// ---------------------------------------------------------------------------

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [current, setCurrentRaw] = useState<AppScreen>({ screen: "loading" });
  const [syncProgress, setSyncProgress] = useState<SyncProgress[]>([]);
  const [syncErrors, setSyncErrors] = useState<string[]>([]);

  const setCurrent = useCallback((screen: AppScreen) => {
    setCurrentRaw(screen);
  }, []);

  useStartupRouting(setCurrent, setSyncProgress, setSyncErrors);

  const navigate = useCallback((next: AppScreen) => {
    setCurrentRaw(next);
  }, []);

  return (
    <AppContext.Provider value={{ current, navigate, syncProgress, syncErrors }}>
      {children}
    </AppContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Helpers for file path persistence
// ---------------------------------------------------------------------------

export function saveFilePath(filePath: string): void {
  localStorage.setItem(LAST_OPENED_KEY, filePath);
}
