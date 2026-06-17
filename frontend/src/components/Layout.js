import { useEffect, useState } from "react";
import { NavLink, useNavigate, useLocation } from "react-router-dom";
import { LayoutDashboard, ImagePlus, FileText, Lightbulb, LogOut, Youtube, Menu, X } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useLang } from "@/contexts/LanguageContext";
import LanguageToggle from "@/components/LanguageToggle";

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const { t } = useLang();
  const nav = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);

  // Close sidebar on route change (mobile)
  useEffect(() => { setOpen(false); }, [location.pathname]);

  // Lock body scroll when mobile drawer is open
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  const items = [
    { to: "/app", label: t("dashboard"), icon: LayoutDashboard, end: true, testid: "nav-dashboard" },
    { to: "/app/studio", label: t("thumbnailStudio"), icon: ImagePlus, testid: "nav-studio" },
    { to: "/app/seo", label: t("seoWriter"), icon: FileText, testid: "nav-seo" },
    { to: "/app/ideas", label: t("ideaGen"), icon: Lightbulb, testid: "nav-ideas" },
  ];

  return (
    <div className="min-h-screen flex bg-[#09090B] text-zinc-100 grain">
      {/* MOBILE TOPBAR */}
      <header className="lg:hidden fixed top-0 left-0 right-0 z-30 h-14 bg-[#09090B]/95 backdrop-blur border-b border-zinc-800 flex items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-[#FF3B30] rounded-sm flex items-center justify-center">
            <Youtube className="w-4 h-4 text-white" strokeWidth={2.5} />
          </div>
          <span className="font-display text-lg">TubeKit</span>
        </div>
        <button
          onClick={() => setOpen(true)}
          data-testid="mobile-menu-open-btn"
          aria-label="Open menu"
          className="w-10 h-10 inline-flex items-center justify-center rounded-sm border border-zinc-800 hover:border-[#FF3B30] text-zinc-300 hover:text-white"
        >
          <Menu className="w-5 h-5" />
        </button>
      </header>

      {/* MOBILE BACKDROP */}
      {open && (
        <div
          className="lg:hidden fixed inset-0 bg-black/60 z-40"
          onClick={() => setOpen(false)}
          data-testid="mobile-menu-backdrop"
        />
      )}

      {/* SIDEBAR (desktop fixed; mobile drawer) */}
      <aside
        className={`w-64 border-r border-zinc-800 fixed left-0 top-0 h-screen flex flex-col p-5 z-50 bg-[#09090B] transition-transform duration-200 lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        } lg:z-10`}
        data-testid="sidebar"
      >
        <div className="flex items-center justify-between mb-10">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-[#FF3B30] rounded-sm flex items-center justify-center">
              <Youtube className="w-5 h-5 text-white" strokeWidth={2.5} />
            </div>
            <span className="font-display text-xl">TubeKit</span>
          </div>
          <button
            onClick={() => setOpen(false)}
            data-testid="mobile-menu-close-btn"
            aria-label="Close menu"
            className="lg:hidden w-9 h-9 inline-flex items-center justify-center rounded-sm text-zinc-400 hover:text-white hover:bg-zinc-900/60"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex flex-col gap-1 flex-1">
          {items.map((it) => (
            <NavLink
              key={it.to}
              to={it.to}
              end={it.end}
              data-testid={it.testid}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-sm text-sm transition-colors ${
                  isActive
                    ? "bg-zinc-900 text-white border-l-2 border-[#FF3B30]"
                    : "text-zinc-400 hover:text-white hover:bg-zinc-900/60"
                }`
              }
            >
              <it.icon className="w-4 h-4" />
              {it.label}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-zinc-800 pt-4 mt-4">
          <div className="flex items-center justify-between mb-3">
            <div className="text-xs font-mono text-zinc-500 truncate" data-testid="sidebar-user-email">
              {user?.email}
            </div>
            <LanguageToggle />
          </div>
          <button
            onClick={() => { logout(); nav("/"); }}
            data-testid="logout-btn"
            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-zinc-400 hover:text-white hover:bg-zinc-900/60 rounded-sm transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            {t("logout")}
          </button>
        </div>
      </aside>

      <main className="lg:ml-64 flex-1 min-h-screen relative z-[2] pt-14 lg:pt-0">
        {children}
      </main>
    </div>
  );
}
