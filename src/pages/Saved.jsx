import { useEffect, useState } from "react";
import OpportunityCard from "@/components/OpportunityCard";
import { Bookmark, Loader2 } from "lucide-react";
import { apiListSaved } from "@/lib/api";

export default function Saved() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const reload = () => {
    setLoading(true);
    apiListSaved().then(setItems).catch(() => setItems([])).finally(() => setLoading(false));
  };

  useEffect(reload, []);

  return (
    <div className="max-w-5xl" data-testid="saved-page">
      <div className="mb-8">
        <div className="text-[10px] uppercase tracking-[0.22em] text-sky-600 font-bold">Your shortlist</div>
        <h1 className="mt-2 font-display text-4xl md:text-5xl font-bold tracking-tight">Saved Opportunities</h1>
        <p className="mt-3 text-slate-500">Curated programs you marked for later. Open one to draft an application.</p>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="animate-spin text-sky-600" /></div>
      ) : items.length === 0 ? (
        <div className="border border-dashed border-slate-300 p-16 text-center bg-white">
          <Bookmark size={28} className="mx-auto text-slate-400" />
          <div className="mt-4 font-semibold">Nothing saved yet</div>
          <div className="mt-2 text-sm text-slate-500">Use the Explorer to bookmark opportunities you want to apply to.</div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {items.map((o) => <OpportunityCard key={o.opportunity_id} opp={o} onChange={reload} />)}
        </div>
      )}
    </div>
  );
}
