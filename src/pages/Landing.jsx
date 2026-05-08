import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowUpRight,
  Sparkles,
  FileText,
  Target,
  Building2,
  Briefcase,
  CheckCircle2,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const MARQUEE = [
  "DPIIT Recognised",
  "Sequoia Surge",
  "Y Combinator",
  "NSRCEL",
  "NIDHI Seed",
  "L'Oreal Green Sciences",
  "Tata Trusts",
  "Mahindra Susten",
  "Reliance Foundation",
  "AWS Activate",
  "Microsoft for Startups",
];

const PRODUCT_CARDS = [
  {
    id: "job-01",
    eyebrow: "Job 01",
    title: "Discovery that thinks like an analyst",
    body: "Scan schemes, grants, accelerators, tenders, and contests in one search tuned to your stage, sector, and deadlines.",
    Icon: Target,
    tone: "dark",
    chips: ["Smart ranking", "Verified programs", "Business opportunities"],
    stat: "66",
    statLabel: "matches ready",
  },
  {
    id: "job-02",
    eyebrow: "Job 02",
    title: "Draft faster with your own context",
    body: "Generate a high-quality first draft from your startup profile, then Smart Apply captures live portal fields, maps the right answers, and fills the official form for final review.",
    Icon: Sparkles,
    tone: "light",
    chips: ["80% first draft", "Smart Apply extension", "Field mapping"],
    assistantPreview: true,
    stat: "80%",
    statLabel: "first draft filled",
  },
  {
    id: "job-03",
    eyebrow: "Job 03",
    title: "Track the pipeline until it closes",
    body: "Move from applied to accepted with status tracking, reminders, notes, and next-step signals in one operating view.",
    Icon: FileText,
    tone: "deep",
    chips: ["Status tracking", "Deadline nudges", "Team visibility"],
    stat: "1",
    statLabel: "workspace to run it all",
  },
];

export default function Landing() {
  return (
    <div className="min-h-screen bg-[#FAF9F6] text-slate-900 overflow-x-hidden" data-testid="landing-page">
      <header className="sticky top-0 z-50 bg-[#FAF9F6]/80 backdrop-blur-xl border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-6 md:px-10 h-16 flex items-center justify-between">
          <Link to="/" className="inline-flex items-baseline gap-0.5">
            <span className="font-display text-2xl font-bold tracking-tighter">FundMe</span>
            <span className="text-emerald-700 text-2xl font-bold">.</span>
          </Link>
          <nav className="hidden md:flex items-center gap-8 text-sm text-slate-600">
            <a href="#product" className="hover:text-slate-900">Product</a>
            <a href="#how" className="hover:text-slate-900">How it works</a>
            <a href="#stats" className="hover:text-slate-900">Numbers</a>
          </nav>
          <div className="flex items-center gap-2">
            <Link to="/login">
              <Button variant="outline" className="rounded-md border-slate-300 text-slate-700 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200 transition-all" data-testid="nav-login">
                Log in
              </Button>
            </Link>
            <Link to="/signup">
              <Button className="rounded-md bg-emerald-700 hover:bg-emerald-800 text-white" data-testid="cta-launch">
                Get started <ArrowUpRight size={14} className="ml-1" />
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10 grain" />
        <div className="absolute -top-40 -right-40 h-[520px] w-[520px] rounded-full bg-emerald-200/40 blur-3xl -z-10" />
        <div className="absolute top-40 -left-40 h-[420px] w-[420px] rounded-full bg-emerald-200/40 blur-3xl -z-10" />

        <div className="max-w-7xl mx-auto px-6 md:px-10 pt-20 pb-24 md:pt-32 md:pb-36">
          <div className="grid lg:grid-cols-12 gap-12">
            <div className="lg:col-span-8">
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
                className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-emerald-200 bg-emerald-50 text-emerald-800 text-xs font-medium mb-8"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-600 animate-pulse" />
                Funding OS for India&apos;s next 10,000 founders
              </motion.div>

              <motion.h1
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, delay: 0.05 }}
                className="font-display text-5xl sm:text-6xl lg:text-[88px] font-bold tracking-[-0.04em] leading-[0.95]"
              >
                Stop hunting grants.
                <br />
                Start <span className="font-serif-display text-emerald-700">winning</span> them.
              </motion.h1>

              <motion.p
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.15 }}
                className="mt-8 text-lg md:text-xl text-slate-600 max-w-2xl leading-relaxed"
              >
                FundMe scans 1,200+ government schemes, accelerators, and corporate programs every day, then drafts your
                application in your voice. From discovery to accepted in one workspace.
              </motion.p>

              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.22 }}
                className="mt-10 flex flex-wrap gap-3"
              >
                <Link to="/signup">
                  <Button size="lg" className="h-12 px-7 rounded-md bg-emerald-700 hover:bg-emerald-800 text-white text-base" data-testid="hero-cta-primary">
                    Get matched in 60 seconds <ArrowUpRight size={16} className="ml-2" />
                  </Button>
                </Link>
                <Link to="/login">
                  <Button variant="outline" size="lg" className="h-12 px-7 rounded-md border-emerald-300 text-emerald-900 hover:bg-emerald-50 hover:text-emerald-700" data-testid="hero-cta-secondary">
                    I already have an account
                  </Button>
                </Link>
              </motion.div>

              <div className="mt-10 flex items-center gap-6 text-xs text-slate-500">
                <div className="flex items-center gap-2"><CheckCircle2 size={14} className="text-emerald-600" /> No card for first 5 refreshes</div>
                <div className="flex items-center gap-2"><CheckCircle2 size={14} className="text-emerald-600" /> Premium unlocks unlimited</div>
                <div className="flex items-center gap-2"><CheckCircle2 size={14} className="text-emerald-600" /> ISO-grade privacy</div>
              </div>
            </div>

            <div className="lg:col-span-4 hidden lg:block">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.7, delay: 0.2 }}
                className="relative"
              >
                <div className="bg-white border border-slate-200 p-6 shadow-[0_30px_60px_-30px_rgba(15,23,42,0.25)]">
                  <div className="text-[10px] uppercase tracking-[0.2em] text-emerald-700 font-bold">Live match</div>
                  <div className="mt-2 font-display text-2xl font-semibold leading-tight">Mookerji Innovation Fund</div>
                  <div className="mt-1 text-xs text-slate-500">Govt. India | Deep-Tech</div>
                  <div className="mt-5 flex items-baseline gap-2">
                    <div className="font-display text-5xl font-bold tracking-tighter">95</div>
                    <div className="text-sm text-slate-500">% match</div>
                  </div>
                  <div className="mt-3 h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                    <motion.div initial={{ width: 0 }} animate={{ width: "95%" }} transition={{ duration: 1.4, delay: 0.6 }} className="h-full bg-emerald-700" />
                  </div>
                  <div className="mt-6 grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-slate-50 px-3 py-2"><div className="text-slate-500">Grant</div><div className="font-semibold">Rs 1.5 Cr</div></div>
                    <div className="bg-slate-50 px-3 py-2"><div className="text-slate-500">Deadline</div><div className="font-semibold text-emerald-700">May 5</div></div>
                  </div>
                </div>
                <div className="absolute -bottom-6 -left-8 bg-emerald-100 border border-emerald-200 px-4 py-3 shadow-md text-xs font-medium text-emerald-900 max-w-[180px]">
                  <Sparkles size={12} className="inline mr-1" /> AI drafted Section 3 in 8s
                </div>
              </motion.div>
            </div>
          </div>
        </div>

        <div className="border-y border-slate-200 bg-white py-5 overflow-hidden">
          <div className="flex marquee-track whitespace-nowrap">
            {[...MARQUEE, ...MARQUEE].map((item, i) => (
              <div key={i} className="px-8 text-sm text-slate-500 font-medium tracking-wide flex items-center gap-8">
                {item} <span className="text-emerald-300">•</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="product" className="max-w-7xl mx-auto px-6 md:px-10 py-24 md:py-32">
        <div className="max-w-3xl mb-14">
          <div className="text-xs uppercase tracking-[0.24em] text-emerald-700 font-bold mb-4">The product</div>
          <h2 className="font-display text-4xl md:text-6xl font-bold tracking-tight leading-[1.1]">
            Three jobs, one workspace, <span className="font-serif-display text-emerald-700 italic">zero spreadsheets.</span>
          </h2>
          <p className="mt-6 text-slate-600 text-lg leading-relaxed">
            Discovery, drafting, and application tracking run as one workflow so every opportunity moves faster with better context.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-5 bg-gradient-to-b from-emerald-950 via-emerald-900 to-emerald-950 text-white rounded-2xl border border-emerald-800/80 p-8 lg:p-10 shadow-[0_35px_70px_-30px_rgba(6,78,59,0.7)]">
            <div className="text-xs uppercase tracking-[0.24em] text-emerald-300 font-semibold">AI funding OS</div>
            <h3 className="mt-4 font-display text-4xl lg:text-5xl font-bold leading-tight">One profile that powers every application.</h3>
            <p className="mt-5 text-emerald-100/90 leading-relaxed">
              FundMe turns founder context into action: ranked opportunities, eligibility checks, portal-ready drafts, Smart Apply form fill, and tracked follow-ups.
            </p>
            <div className="mt-8 grid grid-cols-2 gap-3">
              <MetricTile number="1" label="Reusable startup profile" />
              <MetricTile number="100" label="Point AI fit score" />
              <MetricTile number="5" label="AI refreshes included" />
              <MetricTile number="1" label="Tracked funding pipeline" />
            </div>
            <div className="mt-8 rounded-2xl border border-emerald-700/70 bg-emerald-900/35 p-5">
              <div className="text-[10px] uppercase tracking-[0.2em] text-emerald-300 font-bold">Business opportunities</div>
              <p className="mt-3 text-sm leading-relaxed text-emerald-50/85">
                Beyond grants, FundMe surfaces revenue paths like government tenders, reverse auctions, corporate pilots, paid trials, and partnership programs matched to the startup profile.
              </p>
            </div>
          </div>

          <div className="lg:col-span-7 space-y-4">
            {PRODUCT_CARDS.map((card) => (
              <WorkflowCard key={card.id} {...card} />
            ))}
          </div>
        </div>

        <div className="mt-10 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <ConnectCard Icon={Building2} title="Profile" body="AI-generated founder context" />
          <ConnectCard Icon={Target} title="Explorer" body="AI-ranked opportunity feed" />
          <ConnectCard Icon={Briefcase} title="Business" body="AI-matched pilots and tenders" />
          <ConnectCard Icon={Sparkles} title="Drafts" body="AI-assisted writing" />
          <ConnectCard Icon={FileText} title="Applications" body="Pipeline visibility" />
          <ConnectCard Icon={Zap} title="Insights" body="AI-powered winning signals" />
        </div>
      </section>

      <section id="how" className="relative bg-[#FAF9F6] py-24 md:py-32 scroll-mt-20 overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full max-w-4xl max-h-[600px] bg-emerald-50/20 blur-[120px] rounded-full -z-10" />

        <div className="max-w-7xl mx-auto px-6 md:px-10">
          <div className="text-center max-w-3xl mx-auto mb-20">
            <div className="text-xs uppercase tracking-[0.24em] text-emerald-700 font-bold mb-4">The process</div>
            <h2 className="font-display text-4xl md:text-6xl font-bold tracking-tight leading-[1.1]">
              From startup profile to <span className="font-serif-display text-emerald-700">accepted.</span>
            </h2>
            <p className="mt-6 text-zinc-600 text-lg">
              We engineered a funding workflow that removes guesswork and cuts the admin overhead.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                title: "Build your profile",
                body: "Centralize your stage, sector, traction, and key documents once. This becomes your source of truth.",
                step: "01",
                icon: <Building2 className="text-emerald-700" size={20} />,
              },
              {
                title: "Get ranked matches",
                body: "Our engine filters 1,200+ programs to show only what fits your startup stage and sector.",
                step: "02",
                icon: <Target className="text-emerald-700" size={20} />,
              },
              {
                title: "Create the draft",
                body: "FundMe starts the application using your profile data, then the extension helps carry that draft into the official portal for review and submission.",
                step: "03",
                icon: <FileText className="text-emerald-700" size={20} />,
              },
              {
                title: "Manage pipeline",
                body: "Track every status, deadline, and follow-up in one view so no high-fit opportunity slips away.",
                step: "04",
                icon: <Zap className="text-emerald-700" size={20} />,
              },
            ].map((step, i) => (
              <motion.div
                key={i}
                whileHover={{ y: -5 }}
                className="relative group bg-white border border-zinc-200 p-8 rounded-2xl shadow-sm hover:shadow-md transition-all duration-300"
              >
                <div className="flex items-center justify-between mb-8">
                  <div className="h-10 w-10 rounded-xl bg-emerald-50 flex items-center justify-center">{step.icon}</div>
                  <div className="font-display text-4xl font-bold text-emerald-600/20 group-hover:text-emerald-600/30 transition-colors">
                    {step.step}
                  </div>
                </div>
                <h3 className="font-display text-xl font-bold tracking-tight mb-3 text-black">{step.title}</h3>
                <p className="text-zinc-600 text-sm leading-relaxed">{step.body}</p>
                {i < 3 && <div className="hidden lg:block absolute top-[40%] -right-3.5 w-7 border-t-2 border-dashed border-emerald-100 z-10" />}
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section id="stats" className="bg-white border-y border-slate-200">
        <div className="max-w-7xl mx-auto px-6 md:px-10 py-20 grid grid-cols-2 md:grid-cols-4 gap-10">
          {[
            ["1,247", "Active programs"],
            ["Rs 420Cr", "Funding mapped"],
            ["3.4x", "Faster drafting"],
            ["92%", "Match accuracy"],
          ].map(([n, l]) => (
            <div key={l}>
              <div className="font-display text-5xl md:text-6xl font-bold tracking-tighter text-emerald-700">{n}</div>
              <div className="mt-2 text-sm text-slate-500 uppercase tracking-wider">{l}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-6 md:px-10 py-28 md:py-36 text-center">
        <h3 className="font-display text-5xl md:text-7xl font-bold tracking-tighter leading-[0.95] max-w-4xl mx-auto">
          Your next grant is <span className="font-serif-display text-emerald-700">already</span> on FundMe.
        </h3>
        <p className="mt-6 text-lg text-slate-600 max-w-xl mx-auto">
          Plug your startup profile in, get a ranked list, and draft your first application in under 8 minutes.
        </p>
        <Link to="/signup">
          <Button size="lg" className="mt-10 h-14 px-9 rounded-md bg-emerald-700 hover:bg-emerald-800 text-white text-base" data-testid="cta-final">
            Get started <ArrowUpRight size={16} className="ml-2" />
          </Button>
        </Link>
      </section>

      <footer className="border-t border-slate-200 py-10 text-center text-sm text-slate-500">
        © 2026 FundMe. Built for the Indian founder.
      </footer>
    </div>
  );
}

function MetricTile({ number, label }) {
  return (
    <div className="border border-emerald-700/70 bg-emerald-900/45 rounded-xl px-3 py-3">
      <div className="font-display text-2xl font-bold">{number}</div>
      <div className="text-[11px] uppercase tracking-wider text-emerald-200/85">{label}</div>
    </div>
  );
}

function WorkflowCard({ eyebrow, title, body, Icon, chips, stat, statLabel, tone, assistantPreview }) {
  const toneMap = {
    dark: "bg-emerald-700 text-white border-emerald-600",
    light: "bg-white text-slate-900 border-emerald-100",
    deep: "bg-emerald-950 text-white border-emerald-900",
  };
  const isDark = tone !== "light";
  return (
    <motion.div
      whileHover={{ y: -4 }}
      transition={{ type: "spring", stiffness: 320, damping: 28 }}
      className={`rounded-2xl border p-6 md:p-7 ${toneMap[tone]}`}
    >
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div className="flex-1">
          <div className={`inline-flex h-11 w-11 rounded-xl items-center justify-center ${isDark ? "bg-white/10" : "bg-emerald-50"}`}>
            <Icon size={20} className={isDark ? "text-emerald-200" : "text-emerald-700"} />
          </div>
          <div className={`mt-4 text-[11px] uppercase tracking-[0.2em] font-semibold ${isDark ? "text-emerald-200/85" : "text-emerald-700"}`}>
            {eyebrow}
          </div>
          <h3 className="mt-2 font-display text-3xl md:text-[40px] leading-[1.05] font-bold">{title}</h3>
          <p className={`mt-4 leading-relaxed ${isDark ? "text-emerald-50/90" : "text-slate-600"}`}>{body}</p>
          <div className="mt-5 flex flex-wrap gap-2">
            {chips.map((chip) => (
              <span
                key={chip}
                className={`text-xs px-2.5 py-1 rounded-full border ${isDark ? "bg-white/10 border-white/15 text-emerald-100" : "bg-emerald-50 border-emerald-200 text-emerald-800"}`}
              >
                {chip}
              </span>
            ))}
          </div>
        </div>
        <div className={`${assistantPreview ? "w-full sm:w-44" : "w-full sm:w-auto sm:min-w-16"} text-left sm:text-right border-t sm:border-t-0 sm:border-l pt-4 sm:pt-0 sm:pl-4 ${isDark ? "border-white/20" : "border-emerald-200"}`}>
          <div className={`font-display text-5xl font-bold tracking-tighter ${isDark ? "text-white" : "text-emerald-700"}`}>{stat}</div>
          <div className={`text-sm leading-tight mt-1 ${isDark ? "text-emerald-100/80" : "text-slate-500"}`}>{statLabel}</div>
          {assistantPreview && <SmartApplyPreview />}
        </div>
      </div>
    </motion.div>
  );
}

function SmartApplyPreview() {
  return (
    <div className="mt-5 sm:ml-auto w-full max-w-[11rem] rounded-xl border border-emerald-100 bg-gradient-to-b from-white to-emerald-50/80 p-3 text-left shadow-[0_18px_35px_-28px_rgba(6,78,59,0.75)]" aria-label="Smart Apply extension preview">
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="text-[7px] uppercase tracking-[0.16em] text-emerald-700 font-bold">FundMe</div>
          <div className="mt-0.5 text-[10px] font-semibold text-slate-950">Smart Apply Extension</div>
        </div>
        <div className="h-7 w-7 rounded-lg bg-emerald-700 text-white flex items-center justify-center">
          <Sparkles size={13} />
        </div>
      </div>
      <div className="mt-3 rounded-lg border border-emerald-100 bg-white p-2">
        <div className="h-1.5 w-16 rounded-full bg-slate-200" />
        <div className="mt-2 h-7 rounded-md border border-slate-200 bg-slate-50" />
        <div className="mt-1.5 h-7 rounded-md border border-slate-200 bg-slate-50" />
      </div>
      <div className="mt-3 space-y-1.5">
        {["Capture form", "Generate answers", "Fill portal"].map((step) => (
          <div key={step} className="flex items-center justify-between rounded-md border border-emerald-100 bg-white px-2 py-1.5">
            <span className="text-[9px] font-semibold text-slate-700">{step}</span>
            <CheckCircle2 size={11} className="text-emerald-600" />
          </div>
        ))}
      </div>
    </div>
  );
}

function ConnectCard({ Icon, title, body }) {
  return (
    <div className="rounded-xl border border-emerald-100 bg-emerald-50/40 p-4">
      <div className="h-9 w-9 rounded-lg bg-white border border-emerald-200 flex items-center justify-center">
        <Icon size={16} className="text-emerald-700" />
      </div>
      <div className="mt-3 font-semibold text-slate-900">{title}</div>
      <div className="mt-1 text-sm text-slate-600 leading-relaxed">{body}</div>
    </div>
  );
}
