import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, FileText, CheckCircle2, Eye, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { apiListDrafts, apiTrackApplication, errMsg } from "@/lib/api";

const STATUS_STYLES = {
  "IN PROGRESS": "bg-sky-50 text-sky-800 border-sky-200",
  REVIEW: "bg-amber-50 text-amber-800 border-amber-200",
  APPLIED: "bg-slate-100 text-slate-800 border-slate-300",
};

export default function Drafts() {
  const nav = useNavigate();
  const [drafts, setDrafts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);

  const reload = () => {
    setLoading(true);
    apiListDrafts().then(setDrafts).catch(() => setDrafts([])).finally(() => setLoading(false));
  };

  useEffect(reload, []);

  const markApplied = async (d) => {
    setBusyId(d.draft_id);
    try {
      await apiTrackApplication({ opportunity_id: d.opportunity_id, deadline: d.deadline, status: "applied" });
      toast.success("Marked as Applied — moved to Applications");
      reload();
    } catch (e) {
      toast.error(errMsg(e, "Could not mark applied."));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="max-w-5xl" data-testid="drafts-page">
      <div className="mb-10">
        <div className="text-[10px] uppercase tracking-[0.22em] text-sky-600 font-bold">AI-assisted writing</div>
        <h1 className="mt-2 font-display text-4xl md:text-5xl font-bold tracking-tight">Application Drafts</h1>
        <p className="mt-3 text-slate-500">Pick up where you left off. Review AI-generated sections, then mark applied.</p>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="animate-spin text-sky-600" /></div>
      ) : drafts.length === 0 ? (
        <div className="border border-dashed border-slate-300 p-16 text-center bg-white">
          <FileText size={28} className="mx-auto text-slate-400" />
          <div className="mt-4 font-semibold">No drafts yet</div>
          <div className="mt-2 text-sm text-slate-500">Open the Explorer and click <strong>Prepare Draft</strong> on any opportunity.</div>
        </div>
      ) : (
        <div className="space-y-5">
          {drafts.map((d, i) => (
            <motion.div key={d.draft_id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: i * 0.06 }}
              className="bg-white border border-slate-200 hover:border-slate-300 transition-colors overflow-hidden"
              data-testid={`draft-${d.draft_id}`}>
              <div className="h-1 bg-sky-600" />
              <div className="p-6">
                <div className="flex items-start justify-between gap-6 flex-wrap">
                  <div className="flex-1 min-w-[260px]">
                    <div className="flex items-center gap-3 flex-wrap">
                      <h3 className="font-display text-xl font-semibold">Draft: {d.draft_id}</h3>
                      <span className={`text-[11px] font-bold px-2 py-1 rounded-full border tracking-wide ${STATUS_STYLES[d.status] || STATUS_STYLES["IN PROGRESS"]}`}>{d.status}</span>
                    </div>
                    <div className="mt-1 text-sm text-slate-600">{d.opportunity_title}</div>
                    <div className="mt-1 text-xs text-slate-500">Last edited: {d.last_edited}</div>
                  </div>
                  <div className="w-full md:w-72">
                    <div className="flex justify-between text-xs text-slate-500 mb-1.5">
                      <span>AI completion</span><span className="font-semibold text-slate-900" data-testid={`draft-progress-${d.draft_id}`}>{d.progress}%</span>
                    </div>
                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <motion.div initial={{ width: 0 }} animate={{ width: `${d.progress}%` }} transition={{ duration: 1, delay: 0.2 }} className="h-full bg-sky-600" />
                    </div>
                  </div>
                </div>
                <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <Button className="h-11 rounded-md bg-slate-900 hover:bg-slate-800 text-white font-medium btn-press" data-testid={`continue-${d.draft_id}`}
                    onClick={() => nav(`/drafts/${d.draft_id}`)}>
                    Continue Draft <ArrowRight size={14} className="ml-2" />
                  </Button>
                  <Button variant="outline" className="h-11 rounded-md border-slate-300 btn-press" data-testid={`review-${d.draft_id}`}
                    onClick={() => nav(`/drafts/${d.draft_id}?review=true`)}>
                    <Eye size={14} className="mr-2" /> Review
                  </Button>
                  <Button variant="outline" disabled={busyId === d.draft_id}
                    className="h-11 rounded-md border-sky-300 bg-sky-50/50 hover:bg-sky-50 text-sky-900 btn-press disabled:opacity-60"
                    data-testid={`mark-applied-${d.draft_id}`}
                    onClick={() => markApplied(d)}>
                    {busyId === d.draft_id ? <Loader2 size={14} className="mr-2 animate-spin" /> : <CheckCircle2 size={14} className="mr-2" />} Mark Applied
                  </Button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
