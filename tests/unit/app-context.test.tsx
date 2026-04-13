import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { AppProvider, useApp } from "@/lib/app-context";

// Mock @tauri-apps/api/core (used by app-context for file_exists invoke)
vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

import { invoke } from "@tauri-apps/api/core";
const mockInvoke = vi.mocked(invoke);

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
    // localStorage is empty — no lastOpenedFilePath, invoke should not be called
    render(
      <AppProvider>
        <ScreenDisplay />
      </AppProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("screen").textContent).toBe("welcome");
    });
    expect(mockInvoke).not.toHaveBeenCalled();
  });

  it("routes to dashboard when stored file path exists", async () => {
    localStorageMock.setItem("lastOpenedFilePath", "C:/data/my-money.pfdata");
    mockInvoke.mockResolvedValue(true); // file_exists returns true

    render(
      <AppProvider>
        <ScreenDisplay />
      </AppProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("screen").textContent).toBe("dashboard");
    });
    expect(mockInvoke).toHaveBeenCalledWith("file_exists", { path: "C:/data/my-money.pfdata" });
  });

  it("routes to file-not-found when stored file path does not exist", async () => {
    localStorageMock.setItem("lastOpenedFilePath", "C:/data/my-money.pfdata");
    mockInvoke.mockResolvedValue(false); // file_exists returns false

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
