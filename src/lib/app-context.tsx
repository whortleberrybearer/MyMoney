import { invoke } from "@tauri-apps/api/core";
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
  | { screen: "settings"; filePath: string };

// ---------------------------------------------------------------------------
// AppContext
// ---------------------------------------------------------------------------

const LAST_OPENED_KEY = "lastOpenedFilePath";

interface AppContextValue {
  current: AppScreen;
  navigate: (next: AppScreen) => void;
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
  setCurrent: (screen: AppScreen) => void
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
          setCurrent({ screen: "dashboard", filePath: storedPath });
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

  const setCurrent = useCallback((screen: AppScreen) => {
    setCurrentRaw(screen);
  }, []);

  useStartupRouting(setCurrent);

  const navigate = useCallback((next: AppScreen) => {
    setCurrentRaw(next);
  }, []);

  return (
    <AppContext.Provider value={{ current, navigate }}>
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
