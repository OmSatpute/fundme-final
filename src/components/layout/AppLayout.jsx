import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate, Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutGrid, Search, Bookmark, FileText, ClipboardList,
  Briefcase, Building2, Settings as SettingsIcon,
  ChevronRight, ChevronsLeft, LogOut,
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { getUser, clearAuth } from "@/lib/auth";
import { apiGetProfile } from "@/lib/api";
import { getAvatarInitials } from "@/lib/avatar";

const NAV = [
  { to: "/dashboard", label: "Dashboard", Icon: LayoutGrid },
  { to: "/explorer", label: "Explorer", Icon: Search },
  { to: "/saved", label: "Saved", Icon: Bookmark },
  { to: "/drafts", label: "Drafts", Icon: FileText },
  { to: "/applications", label: "Applications", Icon: ClipboardList },
  { to: "/business", label: "Business Opportunities", Icon: Briefcase },
  { to: "/profile", label: "Startup Profile", Icon: Building2 },
  { to: "/settings", label: "Settings", Icon: SettingsIcon },
];

export default function AppLayout() {
  const location = useLocation();
  const nav = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const [profile, setProfile] = useState(null);
  const user = getUser();

  useEffect(() => {
    apiGetProfile().then(setProfile).catch(() => {});
  }, [location.pathname]);

  const completion = (() => {
    if (!profile) return 0;
    const keys = ["startup_name", "sector", "stage", "startup_overview", "problem_statement", "solution_summary", "target_customers", "business_model"];
    return Math.round((keys.filter((k) => profile[k]).length / keys.length) * 100);
  })();

  const startupName = profile?.startup_name || user?.name || "Founder";
  const stage = profile?.stage || "";
  const sector = profile?.sector || "";
  const avatarInitials = getAvatarInitials(startupName, user?.email);

  const signOut = () => {
    clearAuth();
    nav("/login", { replace: true });
  };

  return (
    <div className="min-h-screen bg-[#FAF9F6] text-slate-900 flex" data-testid="app-shell">
      <motion.aside
        animate={{ width: collapsed ? 72 : 256 }}
        transition={{ type: "spring", stiffness: 360, damping: 32 }}
        className="shrink-0 border-r border-slate-200 bg-white flex flex-col h-screen sticky top-0 overflow-hidden"
        data-testid="sidebar"
      >
        <div className={`${collapsed ? "px-3" : "px-6"} pt-7 pb-2 flex items-center justify-between`}>
          <NavLink to="/" className="inline-flex items-baseline gap-0.5" data-testid="sidebar-logo">
            {collapsed ? (
              <span className="font-display text-2xl font-bold tracking-tighter">F<span className="text-[var(--accent)]">.</span></span>
            ) : (
              <>
                <span className="font-display text-2xl font-bold tracking-tighter">FundMe</span>
                <span className="text-[var(--accent)] text-2xl font-bold">.</span>
              </>
            )}
          </NavLink>
        </div>

        {!collapsed && <div className="px-6 mb-6 text-[11px] uppercase tracking-[0.18em] text-slate-400">Funding OS</div>}

        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
          {NAV.map(({ to, label, Icon }) => (
            <NavLink
              key={to}
              to={to}
              data-testid={`nav-${to.replace("/", "")}`}
              title={collapsed ? label : undefined}
              className={({ isActive }) => `group relative flex items-center gap-3 ${collapsed ? "justify-center px-2" : "px-3"} py-2.5 rounded-md text-sm transition-all ${
                isActive ? "bg-[var(--primary-light)] text-[var(--accent)] font-semibold" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              }`}
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <motion.span
                      layoutId="active-bar"
                      className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r-full bg-[var(--accent)]"
                      transition={{ type: "spring", stiffness: 400, damping: 30 }}
                    />
                  )}
                  <Icon size={17} strokeWidth={1.75} className="shrink-0" />
                  <AnimatePresence>
                    {!collapsed && (
                      <motion.span
                        initial={{ opacity: 0, width: 0 }}
                        animate={{ opacity: 1, width: "auto" }}
                        exit={{ opacity: 0, width: 0 }}
                        transition={{ duration: 0.15 }}
                        className="whitespace-nowrap overflow-hidden"
                      >
                        {label}
                      </motion.span>
                    )}
                  </AnimatePresence>
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <button
          onClick={() => setCollapsed((c) => !c)}
          data-testid="sidebar-toggle"
          className="mx-3 mb-3 mt-1 flex items-center justify-center gap-2 h-9 rounded-md border border-slate-200 hover:bg-slate-50 text-slate-500 text-xs font-medium transition-colors"
        >
          {collapsed ? <ChevronRight size={14} /> : <><ChevronsLeft size={14} /> Collapse</>}
        </button>

        {!collapsed && (
          <div className="px-4 py-4 border-t border-slate-200">
            <div className="text-[10px] uppercase tracking-[0.2em] text-slate-400 mb-2">Profile completion</div>
            <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${completion}%` }}
                transition={{ duration: 1.2, ease: "easeOut" }}
                className="h-full bg-[var(--accent)]"
              />
            </div>
            <div className="mt-2 text-xs text-slate-500">{completion}% - {completion >= 80 ? "almost there" : "keep going"}</div>
          </div>
        )}
      </motion.aside>

      <div className="flex-1 min-w-0 flex flex-col">
        <header className="sticky top-0 z-30 bg-[#FAF9F6]/85 backdrop-blur-xl border-b border-slate-200">
          <div className="h-16 px-8 flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <span>FundMe</span>
              <ChevronRight size={14} />
              <span className="text-slate-900 font-medium capitalize">{location.pathname.replace("/", "") || "Dashboard"}</span>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger className="flex items-center gap-3 outline-none" data-testid="user-chip">
                <div className="text-right">
                  <div className="text-sm font-semibold leading-tight">{startupName}</div>
                  <div className="text-[11px] text-slate-500 leading-tight">{[stage, sector].filter(Boolean).join(" | ") || (user?.email || "")}</div>
                </div>
                <div className="h-9 w-9 rounded-full bg-gradient-to-br from-[var(--accent)] to-[var(--primary)] text-white flex items-center justify-center text-xs font-bold tracking-wide ring-2 ring-white shadow-sm">
                  {avatarInitials}
                </div>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="text-xs text-slate-500 font-normal">
                  Signed in as
                  <br />
                  <span className="text-slate-900 font-semibold">{user?.email || startupName}</span>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild data-testid="dropdown-profile"><Link to="/profile" className="cursor-pointer text-slate-900 focus:bg-slate-50 focus:text-slate-900"><Building2 size={14} className="mr-2" /> Startup profile</Link></DropdownMenuItem>
                <DropdownMenuItem asChild data-testid="dropdown-settings"><Link to="/settings" className="cursor-pointer text-slate-900 focus:bg-slate-50 focus:text-slate-900"><SettingsIcon size={14} className="mr-2" /> Settings</Link></DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={signOut} className="text-rose-600 focus:text-rose-700 cursor-pointer" data-testid="dropdown-signout">
                  <LogOut size={14} className="mr-2" /> Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <main className="flex-1 px-8 py-10 overflow-y-auto" data-scroll-root>
          <motion.div key={location.pathname} initial={{ opacity: 1 }} animate={{ opacity: 1 }} className="w-full h-full">
            <Outlet />
          </motion.div>
        </main>
      </div>
    </div>
  );
}
