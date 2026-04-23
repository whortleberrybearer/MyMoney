import { CreditCard, LayoutDashboard, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

type ActiveScreen = "dashboard" | "accounts-overview" | "settings";

interface AppLayoutProps {
  activeScreen: ActiveScreen;
  onNavigateToDashboard: () => void;
  onNavigateToAccountsOverview: () => void;
  onNavigateToSettings: () => void;
  children: React.ReactNode;
}

const NAV_ITEMS = [
  { label: "Dashboard", icon: LayoutDashboard, screen: "dashboard" as ActiveScreen },
  { label: "Accounts", icon: CreditCard, screen: "accounts-overview" as ActiveScreen },
  { label: "Settings", icon: Settings, screen: "settings" as ActiveScreen },
];

export function AppLayout({
  activeScreen,
  onNavigateToDashboard,
  onNavigateToAccountsOverview,
  onNavigateToSettings,
  children,
}: AppLayoutProps) {
  const handlers: Record<ActiveScreen, () => void> = {
    "dashboard": onNavigateToDashboard,
    "accounts-overview": onNavigateToAccountsOverview,
    "settings": onNavigateToSettings,
  };

  return (
    <div className="flex h-screen overflow-hidden">
      <aside
        className="w-[200px] shrink-0 flex flex-col h-full"
        style={{ background: "var(--ds-navy)" }}
      >
        <div className="px-4 py-3.5 border-b border-white/10">
          <div className="text-[22px] font-bold text-white">MyMoney</div>
          <div className="text-[12px] mt-0.5" style={{ color: "rgba(255,255,255,0.35)" }}>
            Personal Finance
          </div>
        </div>

        <div className="px-3 py-2.5 border-b border-white/10">
          <div
            className="text-[11px] uppercase tracking-widest mb-1.5"
            style={{ color: "rgba(255,255,255,0.3)" }}
          >
            Pinned Accounts
          </div>
          <div className="text-[13px] italic" style={{ color: "rgba(255,255,255,0.35)" }}>
            No pinned accounts
          </div>
        </div>

        <nav className="flex-1 pt-1.5">
          {NAV_ITEMS.map(({ label, icon: Icon, screen }) => {
            const isActive = activeScreen === screen;
            return (
              <button
                key={label}
                onClick={handlers[screen]}
                className={cn(
                  "flex items-center gap-2.5 w-full px-4 py-2.5 text-left transition-colors border-l-[3px]",
                  isActive ? "border-white/0" : "border-transparent hover:bg-white/5",
                )}
                style={
                  isActive
                    ? {
                        borderLeftColor: "var(--ds-teal)",
                        background: "color-mix(in srgb, var(--ds-teal) 22%, transparent)",
                      }
                    : undefined
                }
              >
                <Icon
                  className="h-4 w-4 shrink-0"
                  style={{ color: isActive ? "var(--ds-teal)" : "rgba(255,255,255,0.45)" }}
                />
                <span
                  className="text-[15px]"
                  style={{ color: isActive ? "#ffffff" : "rgba(255,255,255,0.6)" }}
                >
                  {label}
                </span>
              </button>
            );
          })}
        </nav>
      </aside>

      <div className="flex-1 min-w-0 overflow-hidden">
        {children}
      </div>
    </div>
  );
}

export function TopBar({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div
      className="h-[52px] shrink-0 flex items-center px-5 gap-3.5 border-b"
      style={{
        background: "var(--ds-surface)",
        borderColor: "var(--ds-border)",
      }}
    >
      <div className="flex-1">
        <span className="text-[20px] font-bold" style={{ color: "var(--ds-text)" }}>
          {title}
        </span>
        {subtitle && (
          <span className="text-[13px] ml-2.5" style={{ color: "var(--ds-text-dim)" }}>
            {subtitle}
          </span>
        )}
      </div>
      <div
        className="border rounded px-2.5 py-1.5 w-[180px] text-[14px]"
        style={{ borderColor: "var(--ds-border)", color: "var(--ds-text-mid)" }}
      >
        ⌕ Search…
      </div>
    </div>
  );
}
