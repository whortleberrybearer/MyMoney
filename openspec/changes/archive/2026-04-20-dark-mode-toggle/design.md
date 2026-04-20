## Context

The app's CSS already defines both `:root` (light) and `.dark` token sets in `App.css`, and the Tailwind custom variant `@custom-variant dark (&:is(.dark *))` is in place. Dark mode activates simply by adding the `.dark` class to `<html>`. No Tailwind config change is needed — the infrastructure is ready; only the toggle mechanism is missing.

The app currently has no React context for theming. The existing persistence pattern uses `localStorage` (see `app-context.tsx` — `lastOpenedFilePath`). Tauri's config store is **not** currently a dependency.

## Goals / Non-Goals

**Goals:**
- Let the user choose Light, Dark, or System theme from the Settings screen
- Apply the chosen theme immediately, with no save step
- Persist the preference across restarts
- On System, detect OS preference once at startup; do not react to OS changes at runtime

**Non-Goals:**
- Dynamic response to OS theme changes while the app is running
- Per-profile theme preferences
- Any other theming customisation (font size, accent colour, etc.)

## Decisions

### Decision 1: Use `localStorage` for persistence (not `tauri-plugin-store`)

The issue mentions "Tauri's config store" but the project uses `localStorage` for all existing preference persistence (`lastOpenedFilePath`). Adding `tauri-plugin-store` would introduce a new Rust dependency, a new Cargo registration step, and a new async API surface — purely for a single string value that `localStorage` already handles reliably in Tauri's WebView.

**Choice: `localStorage` key `themePreference`** — consistent with the project pattern, no new dependencies.

### Decision 2: Apply theme by toggling `.dark` on `<html>`

The CSS custom variant `@custom-variant dark (&:is(.dark *))` targets elements that are descendants of `.dark`. Placing `.dark` on `<html>` is the standard shadcn/ui pattern and covers the entire document tree including portals (dialogs, toasts).

**Choice: `document.documentElement.classList.toggle('dark', isDark)`** — one line, no extra wrappers.

### Decision 3: ThemeContext in a new `theme-context.tsx` (mirroring `app-context.tsx`)

The existing `app-context.tsx` pattern (context + provider + hook) is the established shape for cross-cutting state. Theme preference fits naturally here.

**Choice: `src/lib/theme-context.tsx`** exports `ThemeProvider`, `useTheme`, and `ThemePreference` type. `ThemeProvider` wraps `AppProvider` in `App.tsx`.

### Decision 4: OS detection via `window.matchMedia` — read once at provider mount

`window.matchMedia('(prefers-color-scheme: dark)').matches` is synchronous and available in Tauri's WebView. Reading it once at mount satisfies the "System reads OS on startup" requirement without event listeners.

## Risks / Trade-offs

- **`localStorage` vs. Tauri store**: `localStorage` is scoped to the WebView origin. In Tauri this is stable, but it's worth noting the data doesn't live in the OS user-data directory alongside the SQLite file. If the app is ever reset/reinstalled, the preference is lost — this is acceptable for a theme toggle. → No mitigation needed.
- **Flash of unstyled theme (FOUC)**: If theme is applied after React mounts, there may be a brief flash of the wrong theme. → Mitigate by applying the class synchronously in the `ThemeProvider` constructor / `useState` initialiser, before first paint.
- **System preference read once**: If the user changes their OS theme while the app is running with System mode, the app won't update. → This is the specified behaviour; make it visible in the UI label ("System (set at launch)" or similar if helpful, but the spec says just "System").

## Open Questions

- None — requirements are fully specified in the issue.
