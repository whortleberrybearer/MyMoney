import "@testing-library/jest-dom";

// Radix UI components use ResizeObserver internally (e.g. Select, Dialog, Sheet).
// jsdom does not implement it, so we stub it.
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// Radix UI uses window.matchMedia for media-query-aware components.
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
});

// Radix UI portals use scrollIntoView which jsdom does not implement.
window.HTMLElement.prototype.scrollIntoView = () => {};

// Radix UI Select uses pointer capture APIs that jsdom does not implement.
window.HTMLElement.prototype.hasPointerCapture = () => false;
window.HTMLElement.prototype.setPointerCapture = () => {};
window.HTMLElement.prototype.releasePointerCapture = () => {};

// Suppress noisy Radix "act(...)" warnings in test output.
// (These are expected when async state updates happen outside act boundaries.)
const originalConsoleError = console.error;
console.error = (...args: unknown[]) => {
  if (typeof args[0] === "string" && args[0].includes("Warning: An update to")) return;
  originalConsoleError(...args);
};
