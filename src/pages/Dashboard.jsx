import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import CountUp from "react-countup";
import { ArrowRight, Calendar, FileText, Bookmark, Sparkles, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiListOpportunities, apiListDrafts, apiGetProfile, apiSaveOpp, apiUnsaveOpp, apiGetMatchScores } from "@/lib/api";
import { getUser } from "@/lib/auth";

const fade = { initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 } };

const PROFILE_KEYS = ["startup_name", "sector", "stage", "startup_overview", "problem_statement",
                      "solution_summary", "target_customers", "business_model"];

const parseAmount = (s = "") => {
  const m = String(s).match(/(\d+(?:\.\d+)?)\s*(Cr|L|Lakh|Lakhs|Crore|Crores)?/i);
  if (!m) return 0;
  const n = parseFloat(m[1]);
  const u = (m[2] || "").toLowerCase();
  if (u.startsWith("cr")) return n * 1e7;
  if (u.startsWith("l")) return n * 1e5;
  return n;
};
const fmtCr = (rs) => rs >= 1e7 ? `Rs ${(rs / 1e7).toFixed(rs >= 1e8 ? 0 : 1)}Cr` : rs >= 1e5 ? `Rs ${(rs / 1e5).toFixed(0)}L` : "-";

const getDeadlineStyles = (deadlineStr) => {
  const d = new Date(deadlineStr);
  const today = new Date(); today.setHours(0,0,0,0);
  const diff = Math.ceil((d - today) / (1000 * 60 * 60 * 24));
  
  if (diff <= 3) return {
    card: "border border-rose-100 bg-rose-50/50 hover:border-rose-200",
    badge: "border border-rose-100 bg-rose-100/50 text-rose-700",
    text: "text-rose-700"
  };
  if (diff <= 7) return {
    card: "border border-amber-200 bg-amber-50/70 hover:border-amber-300",
    badge: "border border-amber-200 bg-amber-100 text-amber-800",
    text: "text-amber-700"
  };
  return {
    card: "border border-emerald-100 bg-emerald-50/70 hover:border-emerald-200",
    badge: "border border-emerald-100 bg-emerald-100/50 text-emerald-700",
    text: "text-emerald-700"
  };
};

export default function Dashboard() {
  const nav = useNavigate();
  const [data, setData] = useState({ opps: [], drafts: [], profile: null });
  const [loading, setLoading] = useState(true);

  const reload = () => {
    setLoading(true);
    Promise.all([
      apiListOpportunities().catch(() => []),
      apiListDrafts().catch(() => []),
      apiGetProfile().catch(() => null),
    ]).then(([opps, drafts, profile]) => {
      setData({ opps, drafts, profile });
      setLoading(false);

      if (profile && opps.length > 0) {
        apiGetMatchScores(profile, opps).then((scores) => {
          if (!scores || scores.length === 0) return;
          const scoreMap = new Map(scores.map(s => [s.opportunity_id, s.score]));
          setData(prev => ({
            ...prev,
            opps: prev.opps.map(o => ({
              ...o,
              match: scoreMap.has(o.opportunity_id) ? scoreMap.get(o.opportunity_id) : o.match
            }))
          }));
        }).catch(err => console.error("Failed to load match scores:", err));
      }
    });
  };

  useEffect(() => {
    reload();
  }, []);

  const handleToggleSave = async (opp) => {
    try {
      if (opp.saved) {
        await apiUnsaveOpp(opp.opportunity_id);
      } else {
        await apiSaveOpp(opp.opportunity_id);
      }
      // Optimistic update
      setData((prev) => ({
        ...prev,
        opps: prev.opps.map((o) =>
          o.opportunity_id === opp.opportunity_id ? { ...o, saved: !o.saved } : o
        ),
      }));
    } catch (err) {
      console.error("Failed to toggle save:", err);
    }
  };

  if (loading) return <div className="flex items-center justify-center py-32"><Loader2 className="animate-spin text-[var(--accent)]" /></div>;

  const { opps, drafts, profile } = data;
  const user = getUser();
  const firstName = (user?.name || "Founder").split(" ")[0];

  // Compute KPIs client-side (real server has no /dashboard/summary endpoint)
  const today = new Date(); today.setHours(0,0,0,0);
  const BUSINESS_TYPES = new Set(["Contest", "Fellowship", "Other", "Tender", "Reverse Auction"]);
  
  const upcoming = opps.filter((o) => {
    if (!o.deadline) return false;
    const d = new Date(o.deadline);
    if (isNaN(d)) return false;
    const diff = (d - today) / (1000 * 60 * 60 * 24);
    if (diff < 0 || diff > 30) return false;
    if (BUSINESS_TYPES.has(o.type)) return false;
    if (o.match === null || o.match < 50) return false;
    return true;
  }).sort((a, b) => new Date(a.deadline) - new Date(b.deadline));

  const highest = opps.reduce((max, o) => Math.max(max, parseAmount(o.amount)), 0);
  const completion = profile ? Math.round(PROFILE_KEYS.filter((k) => profile[k]).length / PROFILE_KEYS.length * 100) : 0;
  const matches = [...opps].filter((o) => o.match !== null && o.match >= 50).sort((a, b) => (b.match || 0) - (a.match || 0)).slice(0, 6);

  return (
    <div className="space-y-12 max-w-7xl" data-testid="dashboard-page">
      <header className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <div className="text-[10px] uppercase tracking-[0.22em] text-[var(--accent)] font-bold">Overview</div>
          <h1 className="mt-2 font-display text-5xl font-bold tracking-tight leading-none">
            Good morning, <span className="font-serif-display text-[var(--accent)]">{firstName}.</span>
          </h1>
          <p className="mt-3 text-slate-500">Your pipeline, refreshed in real time.</p>
        </div>
      </header>

      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" data-testid="kpi-grid">
        <KpiCard featured value={opps.length} label="Relevant Opportunities" />
        <KpiCard value={upcoming.length} label="Upcoming Deadlines" />
        <KpiCardStr value={highest > 0 ? fmtCr(highest) : "-"} label="Highest Available Grant" />
        <KpiCard value={completion} suffix="%" label="Profile Completion" />
      </section>

      <section data-testid="deadlines-section">
        <div className="flex items-center gap-2 mb-5">
          <Calendar size={16} className="text-[var(--accent)]" />
          <h2 className="font-display text-xl font-semibold">Upcoming deadlines</h2>
        </div>
        {upcoming.length === 0 ? (
          <div className="bg-white border border-dashed border-slate-200 p-10 text-center text-sm text-slate-500">No deadlines in the next 30 days.</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {upcoming.slice(0, 3).map((d, i) => {
              const styles = getDeadlineStyles(d.deadline);
              return (
                <motion.div key={d.opportunity_id} variants={fade} initial="initial" animate="animate" transition={{ duration: 0.4, delay: i * 0.08 }}
                  className={`${styles.card} p-5 transition-colors`}>
                  <span className={`inline-block text-[11px] font-semibold px-2 py-0.5 rounded-full ${styles.badge}`}>{d.deadline}</span>
                  <div className="mt-4 font-display text-lg font-semibold text-slate-900 leading-tight">{d.title}</div>
                  <div className={`mt-3 ${styles.text} text-sm font-medium`}>{d.org}</div>
                </motion.div>
              );
            })}
          </div>
        )}
      </section>

      <section data-testid="drafts-section">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <FileText size={16} className="text-[var(--accent)]" />
            <h2 className="font-display text-xl font-semibold">Drafts in Progress</h2>
          </div>
          <Link to="/drafts" className="text-sm text-[var(--accent)] hover:text-emerald-900 font-medium" data-testid="view-all-drafts">View All Drafts -&gt;</Link>
        </div>
        {drafts.length === 0 ? (
          <div className="bg-white border border-dashed border-slate-200 p-10 text-center text-sm text-slate-500">
            No drafts yet. Open the Explorer and click <strong>Start Draft</strong> on any opportunity.
          </div>
        ) : (
          <div className="bg-white border border-slate-200 overflow-hidden">
            <div className="h-1 bg-[var(--accent)]" />
            <div className="p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="font-display text-lg font-semibold">Draft: {drafts[0].draft_id}</div>
                  <div className="text-sm text-slate-600 mt-1">{drafts[0].opportunity_title}</div>
                  <div className="text-xs text-slate-500 mt-1">Last edited: {drafts[0].last_edited}</div>
                </div>
                <span className="text-[11px] font-bold px-2 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 tracking-wide">{drafts[0].status}</span>
              </div>
              <Link to="/drafts">
                <Button className="mt-6 w-full h-12 rounded-md bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white" data-testid="continue-draft-btn">
                  Open Drafts <ArrowRight size={14} className="ml-2" />
                </Button>
              </Link>
            </div>
          </div>
        )}
      </section>

      <section data-testid="matches-section">
        <div className="flex items-center gap-2 mb-5">
          <Sparkles size={16} className="text-emerald-600" />
          <h2 className="font-display text-xl font-semibold">High Relevance Matches</h2>
        </div>
        <div className="bg-white border border-slate-200 overflow-hidden">
          <div className="grid grid-cols-12 px-6 py-3 text-[11px] uppercase tracking-wider text-slate-500 font-semibold border-b border-slate-200 bg-slate-50">
            <div className="col-span-5">Opportunity</div><div className="col-span-2">Type</div>
            <div className="col-span-2">Amount</div><div className="col-span-2">Deadline</div>
            <div className="col-span-1 text-right">Save</div>
          </div>
          {matches.length === 0 ? (
            <div className="px-6 py-10 text-center text-sm text-slate-500">No matches yet - try refreshing or completing your profile.</div>
          ) : matches.map((row) => (
            <div
              key={row.opportunity_id}
              onClick={() => nav(`/explorer/${row.opportunity_id}`)}
              className="grid grid-cols-12 px-6 py-4 items-center text-sm hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-0 cursor-pointer"
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") nav(`/explorer/${row.opportunity_id}`);
              }}
            >
              <div className="col-span-5 font-medium text-slate-900 line-clamp-1">{row.title}</div>
              <div className="col-span-2 text-slate-600">{row.type}</div>
              <div className="col-span-2 text-slate-600">{row.amount}</div>
              <div className="col-span-2 text-[var(--accent)] font-medium">{row.deadline}</div>
              <div className="col-span-1 text-right">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleToggleSave(row);
                  }}
                  className="p-1 hover:bg-slate-100 rounded-full transition-colors"
                  title={row.saved ? "Unsave" : "Save"}
                >
                  <Bookmark size={15} className={`inline transition-colors ${row.saved ? "fill-[var(--accent)] text-[var(--accent)]" : "text-slate-400"}`} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function KpiCard({ value, label, suffix = "", featured }) {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
      className={`p-6 border transition-all ${featured ? "bg-[var(--primary)] text-white border-[var(--primary)]" : "bg-white border-slate-200 hover:border-slate-300"}`}>
      <div className={`font-display text-5xl font-bold tracking-tighter leading-none ${featured ? "text-white" : "text-slate-900"}`}>
        <CountUp end={value} duration={1.4} />{suffix}
      </div>
      <div className={`mt-4 text-[10px] uppercase tracking-[0.15em] font-bold ${featured ? "text-emerald-400" : "text-slate-400"}`}>{label}</div>
    </motion.div>
  );
}

function KpiCardStr({ value, label }) {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
      className="p-6 border bg-white border-slate-200 hover:border-slate-300 transition-all">
      <div className="font-display text-5xl font-bold tracking-tighter leading-none text-slate-900">{value}</div>
      <div className="mt-4 text-xs uppercase tracking-wider font-semibold text-slate-500">{label}</div>
    </motion.div>
  );
}
