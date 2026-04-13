import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { AppProvider, useApp } from "@/lib/app-context";

// Mock tauri-plugin-fs
vi.mock("@tauri-apps/plugin-fs", () => ({
  exists: vi.fn(),
}));

import { exists } from "@tauri-apps/plugin-fs";
const mockExists = vi.mocked(exists);

// Consumer component that renders the current screen name for assertions
function ScreenDisplay() {
  const { current } = useApp();
  return <div data-testid="screen">{current.screen}</div>;
}

// Provide a real Web Storage-compatible localStorage stub for the test environment
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
  };
})();

vi.stubGlobal("localStorage", localStorageMock);

beforeEach(() => {
  vi.clearAllMocks();
  localStorageMock.clear();
});

describe("useStartupRouting", () => {
  it("routes to welcome when no file path is stored", async () => {
    // localStorage is empty — no lastOpenedFilePath
    render(
      <AppProvider>
        <ScreenDisplay />
      </AppProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("screen").textContent).toBe("welcome");
    });
  });

  it("routes to dashboard when stored file path exists", async () => {
    localStorage.setItem("lastOpenedFilePath", "C:/data/my-money.pfdata");
    mockExists.mockResolvedValue(true);

    render(
      <AppProvider>
        <ScreenDisplay />
      </AppProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("screen").textContent).toBe("dashboard");
    });
  });

  it("routes to file-not-found when stored file path does not exist", async () => {
    localStorage.setItem("lastOpenedFilePath", "C:/data/my-money.pfdata");
    mockExists.mockResolvedValue(false);

    render(
      <AppProvider>
        <ScreenDisplay />
      </AppProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("screen").textContent).toBe("file-not-found");
    });
  });
});
