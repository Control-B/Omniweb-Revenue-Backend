import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { LogOut, Settings, MessageSquare, Code, LayoutDashboard, Key } from "lucide-react";
import { Button } from "@/components/ui/button";

export function Layout({ children }: { children: ReactNode }) {
  const { credentials, logout } = useAuth();
  const [location] = useLocation();

  if (!credentials) return <>{children}</>;

  const navItems = [
    { href: "/settings", label: "Settings", icon: Settings },
    { href: "/conversations", label: "Conversations", icon: MessageSquare },
    { href: "/install", label: "Install", icon: Code },
    { href: "/api-keys", label: "API Keys", icon: Key },
  ];

  return (
    <div className="flex min-h-screen w-full bg-slate-50 dark:bg-slate-950">
      <aside className="w-64 border-r border-border bg-card flex flex-col hidden md:flex">
        <div className="p-6 border-b border-border flex items-center gap-3">
          <div className="bg-primary/10 p-2 rounded-lg text-primary">
            <LayoutDashboard size={24} />
          </div>
          <span className="font-semibold text-lg tracking-tight">Omniweb</span>
        </div>

        <div className="px-4 py-4 mb-2">
          <div className="text-xs uppercase font-medium text-muted-foreground tracking-wider mb-1 px-2">
            Store
          </div>
          <div className="truncate px-2 font-medium text-sm text-foreground/90" title={credentials.shopId}>
            {credentials.shopId}
          </div>
        </div>

        <nav className="flex-1 px-4 space-y-1">
          {navItems.map((item) => (
            <Link key={item.href} href={item.href} className="block">
              <span
                className={`flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors ${
                  location === item.href
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent"
                }`}
                data-testid={`nav-${item.label.toLowerCase().replace(" ", "-")}`}
              >
                <item.icon size={18} />
                {item.label}
              </span>
            </Link>
          ))}
        </nav>

        <div className="p-4 border-t border-border">
          <Button
            variant="ghost"
            className="w-full justify-start text-muted-foreground hover:text-destructive hover:bg-destructive/10"
            onClick={logout}
            data-testid="button-logout"
          >
            <LogOut size={18} className="mr-3" />
            Logout
          </Button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="md:hidden h-16 border-b border-border bg-card flex items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <LayoutDashboard size={20} className="text-primary" />
            <span className="font-semibold text-lg tracking-tight">Omniweb</span>
          </div>
          <Button variant="ghost" size="icon" onClick={logout} data-testid="button-logout-mobile">
            <LogOut size={18} className="text-muted-foreground" />
          </Button>
        </header>

        <nav className="md:hidden border-b border-border bg-card px-2 flex overflow-x-auto">
          {navItems.map((item) => (
            <Link key={item.href} href={item.href}>
              <span
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                  location === item.href
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                <item.icon size={16} />
                {item.label}
              </span>
            </Link>
          ))}
        </nav>

        <div className="flex-1 overflow-y-auto p-4 md:p-8">
          <div className="max-w-5xl mx-auto w-full">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
