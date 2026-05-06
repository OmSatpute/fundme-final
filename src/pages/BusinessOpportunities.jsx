import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, SlidersHorizontal, X, Loader2 } from "lucide-react";
import OpportunityCard from "@/components/OpportunityCard";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { apiListBusinessOpps } from "@/lib/api";

const TYPES = ["Contest", "Fellowship", "Other"];
const SECTORS = ["AI / ML", "AgriTech", "DeepTech", "Fintech", "HealthTech", "Manufacturing", "Social Impact"];
const BENEFITS = ["Mentorship", "Pilot Contract", "Access to Infrastructure", "Paid Trial"];

export default function BusinessOpportunities() {
  const [q, setQ] = useState("");
  const [types, setTypes] = useState([]);
  const [sectors, setSectors] = useState([]);
  const [benefits, setBenefits] = useState([]);
  const [showFilters, setShowFilters] = useState(true);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const reload = () => {
    setLoading(true);
    apiListBusinessOpps().then(setItems).catch(() => setItems([])).finally(() => setLoading(false));
  };
  useEffect(reload, []);

  const toggle = (set, val) => set.includes(val) ? set.filter((v) => v !== val) : [...set, val];

  const filtered = useMemo(() => {
    return items.filter((o) => {
      if (q && !`${o.title} ${o.org}`.toLowerCase().includes(q.toLowerCase())) return false;
      if (types.length && !types.includes(o.type)) return false;
      if (sectors.length && !o.sectors?.some((s) => sectors.includes(s))) return false;
      if (benefits.length && !o.benefits?.some((b) => benefits.includes(b))) return false;
      return true;
    });
  }, [items, q, types, sectors, benefits]);

  const activeCount = types.length + sectors.length + benefits.length;

  return (
    <div className="flex gap-8" data-testid="business-page">
      <AnimatePresence initial={false}>
        {showFilters && (
          <motion.aside initial={{ width: 0, opacity: 0 }} animate={{ width: 256, opacity: 1 }} exit={{ width: 0, opacity: 0 }}
            transition={{ type: "spring", stiffness: 320, damping: 32 }} className="shrink-0 overflow-hidden self-start" data-testid="business-filters">
            <div className="w-64 sticky top-5 space-y-7">
              <div className="flex items-center justify-between">
                <div className="text-xs uppercase tracking-[0.18em] text-slate-500 font-bold">Filters {activeCount > 0 && <span className="ml-1 text-emerald-600">({activeCount})</span>}</div>
                <button onClick={() => setShowFilters(false)} className="p-1 hover:bg-slate-100 rounded-md text-slate-500" data-testid="hide-filters-biz" title="Hide filters"><X size={14} /></button>
              </div>
              <FilterGroup label="Opportunity Type" items={TYPES} active={types} onToggle={(v) => setTypes(toggle(types, v))} testid="filter-biz-type" />
              <FilterGroup label="Sector" items={SECTORS} active={sectors} onToggle={(v) => setSectors(toggle(sectors, v))} testid="filter-biz-sector" />
              <FilterGroup label="Benefits" items={BENEFITS} active={benefits} onToggle={(v) => setBenefits(toggle(benefits, v))} testid="filter-biz-benefits" />
              {activeCount > 0 && (
                <Button variant="ghost" onClick={() => { setTypes([]); setSectors([]); setBenefits([]); }} className="w-full text-xs text-slate-500" data-testid="clear-filters-biz">Clear all</Button>
              )}
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      <section className="flex-1 min-w-0">
        <div className="mb-6">
          <div className="text-[10px] uppercase tracking-[0.22em] text-emerald-600 font-bold">Beyond grants</div>
          <h1 className="mt-2 font-display text-4xl md:text-5xl font-bold tracking-tight">Business Opportunities</h1>
          <p className="mt-3 text-slate-500">Pilots, tenders, and corporate co-builds that turn your traction into revenue.</p>
        </div>

        <div className="flex items-center justify-between gap-3 mb-6 flex-wrap">
          <div className="flex items-center gap-2 flex-1 min-w-[260px]">
            {!showFilters && (
              <Button variant="outline" onClick={() => setShowFilters(true)} className="rounded-md border-slate-300 h-11" data-testid="show-filters-biz">
                <SlidersHorizontal size={14} className="mr-2" /> Filters {activeCount > 0 && <span className="ml-1 text-emerald-600 font-semibold">({activeCount})</span>}
              </Button>
            )}
            <div className="relative flex-1 max-w-md">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <Input placeholder="Search opportunities" value={q} onChange={(e) => setQ(e.target.value)}
                className="pl-9 h-11 rounded-md border-slate-300 bg-white shadow-sm" data-testid="business-search" />
            </div>
          </div>
          <span className="text-sm text-slate-600">Showing <span className="font-semibold text-slate-900">{filtered.length}</span> matches</span>
        </div>

        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="animate-spin text-emerald-600" /></div>
        ) : (
          <motion.div layout className={`grid grid-cols-1 ${showFilters ? "lg:grid-cols-2" : "lg:grid-cols-3"} gap-5`}>
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

