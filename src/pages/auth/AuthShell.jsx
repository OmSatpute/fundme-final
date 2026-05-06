import { Link } from "react-router-dom";

// Shared editorial shell for auth + onboarding screens — matches the bone-white
// "Editorial Future" aesthetic used across Landing & Dashboard. NO dark split panel.
export default function AuthShell({ eyebrow, title, sub, children, footer, narrow = false }) {
  return (
    <div className="min-h-screen bg-[#FAF9F6] text-slate-900 relative overflow-hidden">
      {/* Organic blur shapes */}
      <div className="absolute -top-32 -right-32 h-[420px] w-[420px] rounded-full bg-emerald-200/40 blur-3xl pointer-events-none" />
      <div className="absolute top-1/3 -left-40 h-[360px] w-[360px] rounded-full bg-amber-200/30 blur-3xl pointer-events-none" />
      <div className="absolute inset-0 grain pointer-events-none" />

      {/* Top bar */}
      <header className="relative z-10 border-b border-slate-200/70 bg-[#FAF9F6]/70 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-6 md:px-10 h-16 flex items-center justify-between">
          <Link to="/" className="inline-flex items-baseline gap-0.5">
            <span className="font-display text-2xl font-bold tracking-tighter">FundMe</span>
            <span className="text-emerald-700 text-2xl font-bold">.</span>
          </Link>
          <div className="hidden md:flex items-center gap-6 text-xs text-slate-500">
            <span className="inline-flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-emerald-600" /> AI-Powered</span>
            <span>Founder-First</span>
            <span>Verified Data</span>
          </div>
        </div>
      </header>

      <main className="relative z-10 px-6 md:px-10 py-14 md:py-20">
        <div className={`mx-auto ${narrow ? "max-w-md" : "max-w-xl"}`}>
          {eyebrow && (
            <div className="text-[10px] uppercase tracking-[0.22em] text-emerald-700 font-bold mb-4">{eyebrow}</div>
          )}
          <h1 className="font-display text-4xl md:text-5xl font-bold tracking-[-0.02em] leading-[1.05]">{title}</h1>
          {sub && <p className="mt-4 text-base text-slate-600 max-w-lg">{sub}</p>}
          <div className="mt-10">{children}</div>
          {footer && <div className="mt-8 text-center text-sm text-slate-500">{footer}</div>}
        </div>
      </main>
    </div>
  );
}
