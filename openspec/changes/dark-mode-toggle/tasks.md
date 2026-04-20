## 1. Theme Context

- [x] 1.1 Create `src/lib/theme-context.tsx` with `ThemePreference` type (`"light" | "dark" | "system"`), `ThemeProvider` component, and `useTheme` hook
- [x] 1.2 In `ThemeProvider`, initialise preference from `localStorage.getItem('themePreference')` (default `"system"`) synchronously in the `useState` initialiser
- [x] 1.3 In `ThemeProvider`, apply the theme class to `<html>` on mount and whenever preference changes — resolve `"system"` via `window.matchMedia('(prefers-color-scheme: dark)').matches`
- [x] 1.4 Expose a `setThemePreference` function from the context that updates state, persists to `localStorage`, and re-applies the class immediately

## 2. App Integration

- [ ] 2.1 Wrap `<AppProvider>` with `<ThemeProvider>` in `src/App.tsx` so the theme is applied before any screen renders

## 3. Settings Screen

- [ ] 3.1 Add shadcn/ui `ToggleGroup` / `ToggleGroupItem` to the project (copy component files into `src/components/ui/` per shadcn/ui convention)
- [ ] 3.2 Add an "Appearance" section to `SettingsScreen.tsx` above the "Categories" section, containing a `ToggleGroup` with Light / Dark / System options
- [ ] 3.3 Wire the `ToggleGroup` to `useTheme()` — read current preference for the selected value, call `setThemePreference` on change
