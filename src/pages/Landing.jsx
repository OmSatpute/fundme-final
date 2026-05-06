import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowUpRight, Sparkles, FileText, Target, Building2, Briefcase, CheckCircle2, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";

const MARQUEE = [
  "DPIIT Recognised", "Sequoia Surge", "Y Combinator", "NSRCEL", "NIDHI Seed", "L'Oréal Green Sciences",
  "Tata Trusts", "Mahindra Susten", "Reliance Foundation", "AWS Activate", "Microsoft for Startups",
];

export default function Landing() {
  return (
    <div className="min-h-screen bg-[#FAF9F6] text-slate-900 overflow-x-hidden" data-testid="landing-page">
      {/* Nav */}
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
              <Button variant="ghost" className="rounded-md text-slate-700 hover:bg-slate-100" data-testid="nav-login">
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

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10 grain" />
        <div className="absolute -top-40 -right-40 h-[520px] w-[520px] rounded-full bg-emerald-200/40 blur-3xl -z-10" />
        <div className="absolute top-40 -left-40 h-[420px] w-[420px] rounded-full bg-amber-200/40 blur-3xl -z-10" />

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
                Funding OS for India's next 10,000 founders
              </motion.div>

              <motion.h1
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, delay: 0.05 }}
                className="font-display text-5xl sm:text-6xl lg:text-[88px] font-bold tracking-[-0.04em] leading-[0.95]"
              >
                Stop hunting grants. <br />
                Start <span className="font-serif-display text-emerald-700">winning</span> them.
              </motion.h1>

              <motion.p
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.15 }}
                className="mt-8 text-lg md:text-xl text-slate-600 max-w-2xl leading-relaxed"
              >
                FundMe scans 1,200+ government schemes, accelerators, and corporate programs every day —
                then drafts your application in your voice. From discovery to "Accepted" in one workspace.
              </motion.p>

              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.22 }}
                className="mt-10 flex flex-wrap gap-3"
              >
                <Link to="/signup">
                  <Button size="lg" className="h-12 px-7 rounded-md bg-slate-900 hover:bg-slate-800 text-white text-base" data-testid="hero-cta-primary">
                    Get matched in 60 seconds <ArrowUpRight size={16} className="ml-2" />
                  </Button>
                </Link>
                <Link to="/login">
                  <Button variant="outline" size="lg" className="h-12 px-7 rounded-md border-slate-300 text-base" data-testid="hero-cta-secondary">
                    I already have an account
                  </Button>
                </Link>
              </motion.div>

              <div className="mt-10 flex items-center gap-6 text-xs text-slate-500">
                <div className="flex items-center gap-2"><CheckCircle2 size={14} className="text-emerald-600" /> No card required</div>
                <div className="flex items-center gap-2"><CheckCircle2 size={14} className="text-emerald-600" /> Free for early-stage</div>
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
                  <div className="mt-1 text-xs text-slate-500">Govt. India · Deep-Tech</div>
                  <div className="mt-5 flex items-baseline gap-2">
                    <div className="font-display text-5xl font-bold tracking-tighter">95</div>
                    <div className="text-sm text-slate-500">% match</div>
                  </div>
                  <div className="mt-3 h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                    <motion.div initial={{ width: 0 }} animate={{ width: "95%" }} transition={{ duration: 1.4, delay: 0.6 }} className="h-full bg-emerald-700" />
                  </div>
                  <div className="mt-6 grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-slate-50 px-3 py-2"><div className="text-slate-500">Grant</div><div className="font-semibold">₹1.5 Cr</div></div>
                    <div className="bg-slate-50 px-3 py-2"><div className="text-slate-500">Deadline</div><div className="font-semibold text-rose-600">May 5</div></div>
                  </div>
                </div>
                <div className="absolute -bottom-6 -left-8 bg-amber-100 border border-amber-200 px-4 py-3 shadow-md text-xs font-medium text-amber-900 max-w-[180px]">
                  <Sparkles size={12} className="inline mr-1" /> AI drafted Section 3 in 8s
                </div>
              </motion.div>
            </div>
          </div>
        </div>

        {/* Marquee */}
        <div className="border-y border-slate-200 bg-white py-5 overflow-hidden">
          <div className="flex marquee-track whitespace-nowrap">
            {[...MARQUEE, ...MARQUEE].map((item, i) => (
              <div key={i} className="px-8 text-sm text-slate-500 font-medium tracking-wide flex items-center gap-8">
                {item} <span className="text-slate-300">✦</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Bento features */}
      <section id="product" className="max-w-7xl mx-auto px-6 md:px-10 py-24 md:py-32">
        <div className="max-w-3xl mb-16">
          <div className="text-xs uppercase tracking-[0.24em] text-emerald-700 font-bold mb-4">The platform</div>
          <h2 className="font-display text-4xl md:text-6xl font-bold tracking-tight leading-[1.1]">
            One workspace, <span className="font-serif-display text-emerald-700 italic">infinite</span> leverage.
          </h2>
          <p className="mt-6 text-slate-600 text-lg leading-relaxed">
            We've replaced the chaos of tabs and spreadsheets with a unified system designed to get you funded.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 md:row-rows-2 gap-4 lg:gap-6">
          {/* Discovery - Primary Feature */}
          <BentoCard 
            className="md:col-span-7 md:row-span-2 bg-gradient-to-br from-slate-900 via-slate-900 to-blue-900 text-white border-0 shadow-2xl shadow-blue-900/20" 
            Icon={Target}
            title="Discovery that thinks like an analyst"
            body="55+ relevant matches today. Filter by stage, sector, and funding type. We track 1,200+ programs so you don't have to."
            big 
          />
          
          {/* AI Drafting */}
          <BentoCard 
            className="md:col-span-5 bg-white shadow-sm hover:shadow-xl hover:shadow-slate-200/50 transition-all border-slate-200/60" 
            Icon={Sparkles}
            title="AI-powered drafting"
            body="Pull instantly from your startup profile to fill 80% of any grant or accelerator form in your own voice."
          />

          {/* Smart Profile */}
          <BentoCard 
            className="md:col-span-5 bg-emerald-50/50 border-emerald-100/50" 
            Icon={Building2}
            title="Your Source of Truth"
            body="Keep your stage, traction, and problem statements updated in one place. It powers every other module in the OS."
          />

          {/* Pipeline */}
          <BentoCard 
            className="md:col-span-4 bg-white" 
            Icon={Zap}
            title="Pipeline Management"
            body="Track every status from 'Draft' to 'Accepted' in a unified kanban-style view with smart deadline alerts."
          />

          {/* Business Opps */}
          <BentoCard 
            className="md:col-span-4 bg-emerald-900 text-white border-0" 
            Icon={Briefcase}
            title="Beyond Grants"
            body="Access pilots, corporate tenders, and co-build opportunities that turn your traction into revenue."
          />

          {/* India First */}
          <BentoCard 
            className="md:col-span-4 bg-white" 
            Icon={Target}
            title="Built for India"
            body="Native support for DPIIT, Startup India, GeM, and MSME schemes. We speak the language of the Indian ecosystem."
          />
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="relative bg-[#FAF9F6] py-24 md:py-32 scroll-mt-20 overflow-hidden">
        {/* Subtle background element */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full max-w-4xl max-h-[600px] bg-emerald-100/30 blur-[120px] rounded-full -z-10" />

        <div className="max-w-7xl mx-auto px-6 md:px-10">
          <div className="text-center max-w-3xl mx-auto mb-20">
            <div className="text-xs uppercase tracking-[0.24em] text-emerald-700 font-bold mb-4">The process</div>
            <h2 className="font-display text-4xl md:text-6xl font-bold tracking-tight leading-[1.1]">
              From startup profile to <span className="font-serif-display text-emerald-700">accepted.</span>
            </h2>
            <p className="mt-6 text-slate-600 text-lg">
              We've engineered a funding workflow that eliminates the guesswork and the grind.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { 
                title: "Build your profile", 
                body: "Centralize your stage, sector, traction, and key documents once. This becomes your source of truth.", 
                step: "01",
                icon: <Building2 className="text-emerald-700" size={20} />
              },
              { 
                title: "Get ranked matches", 
                body: "Our engine filters 1,200+ programs to show only what fits your startup's exact fit and stage.", 
                step: "02",
                icon: <Target className="text-emerald-700" size={20} />
              },
              { 
                title: "Create the draft", 
                body: "FundMe starts the application using your profile data, then you refine it with our AI writing assistant.", 
                step: "03", 
                icon: <FileText className="text-emerald-700" size={20} />
              },
              { 
                title: "Manage pipeline", 
                body: "Track every status, deadline, and follow-up in one view. Never miss a high-potential opportunity again.", 
                step: "04",
                icon: <Zap className="text-emerald-700" size={20} />
              },
            ].map((step, i) => (
              <motion.div 
                key={i}
                whileHover={{ y: -5 }}
                className="relative group bg-white border border-slate-200 p-8 rounded-2xl shadow-sm hover:shadow-md transition-all duration-300"
              >
                <div className="flex items-center justify-between mb-8">
                  <div className="h-10 w-10 rounded-xl bg-emerald-50 flex items-center justify-center">
                    {step.icon}
                  </div>
                  <div className="font-display text-4xl font-bold text-emerald-600/20 group-hover:text-emerald-600/30 transition-colors">
                    {step.step}
                  </div>
                </div>
                <h3 className="font-display text-xl font-bold tracking-tight mb-3 text-slate-900">{step.title}</h3>
                <p className="text-slate-600 text-sm leading-relaxed">{step.body}</p>
                
                {/* Stylized connecting divider for desktop */}
                {i < 3 && (
                  <div className="hidden lg:block absolute top-[40%] -right-3.5 w-7 border-t-2 border-dashed border-emerald-100 z-10" />
                )}
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Stats */}
      <section id="stats" className="bg-white border-y border-slate-200">
        <div className="max-w-7xl mx-auto px-6 md:px-10 py-20 grid grid-cols-2 md:grid-cols-4 gap-10">
          {[
            ["1,247", "Active programs"],
            ["₹420Cr", "Funding mapped"],
            ["3.4×", "Faster drafting"],
            ["92%", "Match accuracy"],
          ].map(([n, l]) => (
            <div key={l}>
              <div className="font-display text-5xl md:text-6xl font-bold tracking-tighter text-emerald-700">{n}</div>
              <div className="mt-2 text-sm text-slate-500 uppercase tracking-wider">{l}</div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-7xl mx-auto px-6 md:px-10 py-28 md:py-36 text-center">
        <h3 className="font-display text-5xl md:text-7xl font-bold tracking-tighter leading-[0.95] max-w-4xl mx-auto">
          Your next grant is <span className="font-serif-display text-emerald-700">already</span> on FundMe.
        </h3>
        <p className="mt-6 text-lg text-slate-600 max-w-xl mx-auto">
          Plug your startup profile in, get a ranked list, and draft your first application in under 8 minutes.
        </p>
        <Link to="/signup">
          <Button size="lg" className="mt-10 h-14 px-9 rounded-md bg-slate-900 hover:bg-slate-800 text-white text-base" data-testid="cta-final">
            Get started — it's free <ArrowUpRight size={16} className="ml-2" />
          </Button>
        </Link>
      </section>

      <footer className="border-t border-slate-200 py-10 text-center text-sm text-slate-500">
        © 2026 FundMe. Built for the Indian founder.
      </footer>
    </div>
  );
}

function BentoCard({ className = "", Icon, title, body, big }) {
  const isDark = className.includes("bg-emerald-800") || className.includes("bg-slate-900");
  return (
    <motion.div
      whileHover={{ y: -6, shadow: "0 20px 40px -15px rgba(15,23,42,0.1)" }}
      transition={{ type: "spring", stiffness: 300, damping: 25 }}
      className={`relative p-8 rounded-2xl border border-slate-200/60 overflow-hidden ${className}`}
    >
      <div className={`h-12 w-12 rounded-xl flex items-center justify-center mb-10 ${isDark ? "bg-white/10" : "bg-emerald-50"}`}>
        <Icon size={big ? 28 : 22} strokeWidth={2} className={isDark ? "text-emerald-400" : "text-emerald-700"} />
      </div>
      <div className={`font-display ${big ? "text-3xl md:text-4xl" : "text-xl"} font-bold tracking-tight leading-tight`}>
        {title}
      </div>
      <p className={`mt-4 text-sm leading-relaxed ${isDark ? "text-slate-300" : "text-slate-600"}`}>
        {body}
      </p>
      
      {/* Subtle light effect for dark cards */}
      {isDark && (
        <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-400/10 blur-[60px] rounded-full -mr-16 -mt-16" />
      )}
    </motion.div>
  );
}
