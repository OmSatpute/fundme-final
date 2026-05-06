import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { CheckCircle2, Bookmark, BookmarkCheck, Sparkles, ArrowUpRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { apiSaveOpp, apiUnsaveOpp, apiCreateDraft, apiGetProfile, errMsg } from "@/lib/api";
import axios from "axios";
import { API_BASE } from "@/lib/api";

export default function OpportunityCard({ opp, onChange }) {
  const nav = useNavigate();
  const [saved, setSaved] = useState(!!opp.saved);
  const [busy, setBusy] = useState(false);
  const [draftBusy, setDraftBusy] = useState(false);
  const [eligibilityLoading, setEligibilityLoading] = useState(false);
  const [eligibilityResult, setEligibilityResult] = useState(null);

  useEffect(() => {
    setSaved(!!opp.saved);
  }, [opp.opportunity_id, opp.saved]);

  const toggleSave = async (e) => {
    e.stopPropagation();
    setBusy(true);
    try {
      if (saved) {
        await apiUnsaveOpp(opp.opportunity_id);
        setSaved(false);
        toast.success("Removed from saved");
      } else {
        await apiSaveOpp(opp.opportunity_id);
        setSaved(true);
        toast.success("Saved to your list");
      }
      onChange?.();
    } catch (err) {
      if (err?.response?.status === 409) {
        setSaved(true);
        toast.success("Already in your saved list");
        onChange?.();
        return;
      }
      toast.error(errMsg(err, "Could not update saved list."));
    } finally {
      setBusy(false);
    }
  };

  const prepareDraft = async () => {
    setDraftBusy(true);
    try {
      await apiCreateDraft(opp.opportunity_id);
      toast.success("Draft created — open it from Drafts");
    } catch (err) {
      toast.error(errMsg(err, "Could not create draft."));
    } finally {
      setDraftBusy(false);
    }
  };

  const checkEligibility = async () => {
    setEligibilityLoading(true);
    try {
      const profile = await apiGetProfile();
      if (!profile) {
        toast.error("Please complete your profile first.");
        nav("/onboarding/profile");
        return;
      }

      const response = await axios.post(`${API_BASE}/ai/eligibility`, {
        profile,
        eligibility: opp.eligibility,
        description: opp.summary,
        opportunity_title: opp.title,
        opportunity_sector: opp.sectors?.join(", ")
      });

      setEligibilityResult(response.data.result);
    } catch (err) {
      toast.error(errMsg(err, "Eligibility check failed."));
    } finally {
      setEligibilityLoading(false);
    }
  };

  return (
    <motion.div
      whileHover={{ y: -3 }}
      transition={{ type: "spring", stiffness: 350, damping: 28 }}
      className="group relative bg-white border border-slate-200 hover:border-slate-300 hover:shadow-[0_8px_30px_-12px_rgba(15,23,42,0.15)] transition-all p-6 flex flex-col gap-4"
      data-testid={`opportunity-card-${opp.opportunity_id}`}
    >
      {opp.match ? (
        <div className="absolute top-4 right-4 inline-flex items-center gap-1 px-2 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-[10px] font-bold tracking-wide">
          <Sparkles size={10} />
          {opp.match}% match
        </div>
      ) : null}

      <div>
        <h3 className="font-display text-xl font-semibold text-slate-900 leading-tight pr-20">{opp.title}</h3>
        <div className="mt-2 flex items-center gap-2 text-xs text-slate-500">
          <span className="line-clamp-1">{opp.org}</span>
          {opp.verified && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 font-semibold whitespace-nowrap">
              <CheckCircle2 size={10} /> Verified
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {opp.sectors?.map((s) => (
          <span key={s} className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-blue-50 text-blue-800 border border-blue-100">{s}</span>
        ))}
        {opp.stage && <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-100">{opp.stage}</span>}
        {opp.amount && <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-100">{opp.amount}</span>}
      </div>

      <div className="text-xs">
        <span className="text-slate-500">Deadline:</span>{" "}
        <span className="text-rose-600 font-semibold">{opp.deadline}</span>
      </div>

      {(opp.eligibility || eligibilityResult) && (
        <div className={`transition-all duration-500 border rounded-sm p-3 ${eligibilityResult ? "bg-emerald-50 border-emerald-100" : "bg-slate-50 border-slate-100"}`}>
          <div className="flex items-center justify-between mb-1">
            <div className={`text-[10px] uppercase tracking-wider font-bold ${eligibilityResult ? "text-emerald-700" : "text-slate-500"}`}>
              {eligibilityResult ? "AI Eligibility Analysis" : "Eligibility"}
            </div>
            {eligibilityResult && (
              <div className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${eligibilityResult.includes("INELIGIBLE") ? "bg-rose-100 text-rose-700" : "bg-emerald-100 text-emerald-700"}`}>
                {eligibilityResult.split("\n")[0].replace("STATUS: ", "")}
              </div>
            )}
          </div>
          <div className="text-xs text-slate-700 whitespace-pre-wrap leading-relaxed">
            {eligibilityResult ? (
              eligibilityResult.split("\n").slice(1).join("\n").trim()
            ) : (
              <p className="line-clamp-2">{opp.eligibility}</p>
            )}
          </div>
        </div>
      )}

      <p className="text-sm text-slate-600 line-clamp-2">{opp.summary}</p>

      {!eligibilityResult && (
        <Button variant="outline"
          disabled={eligibilityLoading}
          className="w-full bg-emerald-50/50 border-emerald-200 hover:bg-emerald-50 text-emerald-900 font-medium rounded-md"
          data-testid={`check-eligibility-${opp.opportunity_id}`}
          onClick={checkEligibility}>
          {eligibilityLoading ? (
            <><Loader2 size={14} className="mr-2 animate-spin" /> Analyzing Fit...</>
          ) : (
            <><Sparkles size={14} className="mr-2" /> Check Eligibility</>
          )}
        </Button>
      )}

      <div className="grid grid-cols-3 gap-2 pt-1">
        <Button onClick={toggleSave} disabled={busy}
          className="btn-press rounded-md font-medium bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-60"
          data-testid={`save-toggle-${opp.opportunity_id}`}>
          {busy ? <Loader2 size={14} className="animate-spin" /> :
            saved ? <><BookmarkCheck size={14} className="mr-1" />Unsave</> : <><Bookmark size={14} className="mr-1" />Save</>}
        </Button>
        <Button onClick={prepareDraft} disabled={draftBusy}
          className="btn-press rounded-md bg-slate-900 hover:bg-slate-800 text-white font-medium disabled:opacity-60"
          data-testid={`prepare-draft-${opp.opportunity_id}`}>
          {draftBusy ? <Loader2 size={14} className="animate-spin" /> : "Prepare Draft"}
        </Button>
        <Button variant="outline"
          className="btn-press rounded-md border-slate-300 hover:border-slate-400 text-slate-900 font-medium"
          data-testid={`view-details-${opp.opportunity_id}`}
          onClick={() => nav(`/explorer/${opp.opportunity_id}`)}>
          View Details <ArrowUpRight size={12} className="ml-1" />
        </Button>
      </div>
    </motion.div>
  );
}
