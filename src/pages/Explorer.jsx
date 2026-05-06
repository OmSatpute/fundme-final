import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { LayoutGrid, List, Search, SlidersHorizontal, X, Loader2 } from "lucide-react";
import OpportunityCard from "@/components/OpportunityCard";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { apiListOpportunities } from "@/lib/api";

const STAGES = ["Idea", "MVP", "Early Revenue", "Growth", "PMF"];
const SECTORS = ["AI / ML", "AgriTech", "DeepTech", "Fintech", "HealthTech", "Manufacturing", "Social Impact"];
const TYPES = ["Grant", "Accelerator", "Incubation", "Seed Funding", "Contest", "Fellowship"];

export default function Explorer() {
  const [view, setView] = useState("grid");
  const [q, setQ] = useState("");
  const [stages, setStages] = useState([]);
  const [sectors, setSectors] = useState([]);
  const [types, setTypes] = useState([]);
  const [showFilters, setShowFilters] = useState(true);
  const [opps, setOpps] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { reload(); /* eslint-disable-next-line */ }, []);
  const reload = () => {
    setLoading(true);
    apiListOpportunities().then(setOpps).catch(() => setOpps([])).finally(() => setLoading(false));
  };

  const toggle = (set, val) => set.includes(val) ? set.filter((v) => v !== val) : [...set, val];

  const filtered = useMemo(() => {
    return opps.filter((o) => {
      if (q && !`${o.title} ${o.org}`.toLowerCase().includes(q.toLowerCase())) return false;
      if (types.length && !types.includes(o.type)) return false;
      if (stages.length && o.stage && !stages.some((s) => o.stage.toLowerCase().includes(s.toLowerCase()))) return false;
      if (sectors.length && !o.sectors?.some((s) => sectors.includes(s))) return false;
      return true;
    });
  }, [opps, q, stages, sectors, types]);

  const activeCount = stages.length + sectors.length + types.length;

  return (
    <div className="flex gap-8" data-testid="explorer-page">
      <AnimatePresence initial={false}>
        {showFilters && (
          <motion.aside initial={{ width: 0, opacity: 0 }} animate={{ width: 256, opacity: 1 }} exit={{ width: 0, opacity: 0 }}
            transition={{ type: "spring", stiffness: 320, damping: 32 }} className="shrink-0 overflow-hidden self-start" data-testid="explorer-filters">
            <div className="w-64 sticky top-5 space-y-7">
              <div className="flex items-center justify-between">
                <div className="text-xs uppercase tracking-[0.18em] text-slate-500 font-bold">Filters {activeCount > 0 && <span className="ml-1 text-emerald-600">({activeCount})</span>}</div>
                <button onClick={() => setShowFilters(false)} className="p-1 hover:bg-slate-100 rounded-md text-slate-500" data-testid="hide-filters" title="Hide filters"><X size={14} /></button>
              </div>
              <FilterGroup label="Startup Stage" items={STAGES} active={stages} onToggle={(v) => setStages(toggle(stages, v))} testid="filter-stage" />
              <FilterGroup label="Sector" items={SECTORS} active={sectors} onToggle={(v) => setSectors(toggle(sectors, v))} testid="filter-sector" />
              <FilterGroup label="Funding Type" items={TYPES} active={types} onToggle={(v) => setTypes(toggle(types, v))} testid="filter-type" />
              {activeCount > 0 && (
                <Button variant="ghost" onClick={() => { setStages([]); setSectors([]); setTypes([]); }} className="w-full text-xs text-slate-500" data-testid="clear-filters">Clear all</Button>
              )}
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      <section className="flex-1 min-w-0">
        <div className="mb-6">
          <div className="text-[10px] uppercase tracking-[0.22em] text-emerald-600 font-bold">Discover</div>
          <h1 className="mt-2 font-display text-4xl md:text-5xl font-bold tracking-tight">Opportunities Explorer</h1>
        </div>

        <div className="flex items-center justify-between gap-3 mb-6 flex-wrap">
          <div className="flex items-center gap-2 flex-1 min-w-[260px]">
            {!showFilters && (
              <Button variant="outline" onClick={() => setShowFilters(true)} className="rounded-md border-slate-300 h-11" data-testid="show-filters">
                <SlidersHorizontal size={14} className="mr-2" /> Filters {activeCount > 0 && <span className="ml-1 text-emerald-600 font-semibold">({activeCount})</span>}
              </Button>
            )}
            <div className="relative flex-1 max-w-md">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <Input placeholder="Search by name or organisation" value={q} onChange={(e) => setQ(e.target.value)}
                className="pl-9 h-11 rounded-md border-slate-300 bg-white shadow-sm" data-testid="explorer-search" />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-slate-600">Showing <span className="font-semibold text-slate-900">{filtered.length}</span> matches</span>
            <div className="flex border border-slate-300 rounded-md overflow-hidden">
              <button onClick={() => setView("grid")} data-testid="view-grid" className={`p-2 ${view === "grid" ? "bg-emerald-700 text-white" : "bg-white text-slate-600"}`}><LayoutGrid size={15} /></button>
              <button onClick={() => setView("list")} data-testid="view-list" className={`p-2 ${view === "list" ? "bg-emerald-700 text-white" : "bg-white text-slate-600"}`}><List size={15} /></button>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="animate-spin text-emerald-600" /></div>
        ) : (
          <motion.div layout className={view === "grid" ? `grid grid-cols-1 ${showFilters ? "lg:grid-cols-2" : "lg:grid-cols-3"} gap-5` : "flex flex-col gap-5"}>
            {filtered.map((o) => <OpportunityCard key={o.opportunity_id} opp={o} onChange={reload} />)}
          </motion.div>
        )}
      </section>
    </div>
  );
}

function FilterGroup({ label, items, active, onToggle, testid }) {
  return (
    <div data-testid={testid}>
      <div className="text-xs uppercase tracking-[0.18em] text-slate-500 font-bold mb-3">{label}</div>
      <div className="space-y-2.5">
        {items.map((item) => (
          <label key={item} className="flex items-center gap-2.5 cursor-pointer group">
            <Checkbox checked={active.includes(item)} onCheckedChange={() => onToggle(item)}
              className="data-[state=checked]:bg-emerald-600 data-[state=checked]:border-emerald-600"
              data-testid={`${testid}-${item}`} />
            <span className="text-sm text-slate-700 group-hover:text-slate-900">{item}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

