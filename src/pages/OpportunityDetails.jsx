import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { 
  ArrowLeft, Sparkles, Calendar, DollarSign, MapPin, 
  ExternalLink, Bookmark, FileEdit, CheckCircle2, 
  Info, ShieldCheck, Gift, ListChecks, Loader2, ChevronRight
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { ExtensionInstallModal } from "@/components/ExtensionInstallModal";
import { apiListOpportunities, apiSaveOpp, apiUnsaveOpp, apiListSaved, apiCreateDraft, apiGetDraftByOpportunity, errMsg } from "@/lib/api";
import { stageExtensionContext } from "@/lib/applyFlow";
import { checkExtensionInstalled } from "@/lib/utils";

export default function OpportunityDetails() {
  const { id } = useParams();
  const nav = useNavigate();
  const [opp, setOpp] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isSaved, setIsSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState(null);
  const [draftBusy, setDraftBusy] = useState(false);
  const [applyBusy, setApplyBusy] = useState(false);
  const [showExtensionModal, setShowExtensionModal] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const list = await apiListOpportunities();
        const found = list.find(o => o.opportunity_id === id);
        if (found) {
          setOpp(found);
          // Check if saved
          const saved = await apiListSaved();
          setIsSaved(saved.some(s => s.opportunity_id === id));
          setDraft(await apiGetDraftByOpportunity(id));
          
          // Auto-trigger portal if we just reloaded for extension on THIS page
          if (sessionStorage.getItem("FUNDME_EXT_RELOAD") === window.location.pathname) {
            sessionStorage.removeItem("FUNDME_EXT_RELOAD");
            // Give it a tiny moment to ensure extension is ready
            setTimeout(() => {
              const btn = document.querySelector('[data-testid="apply-portal-btn"]');
              if (btn) btn.click();
            }, 800);
          }
        } else {
          toast.error("Opportunity not found");
          nav("/explorer");
        }
      } catch (e) {
        toast.error(errMsg(e, "Failed to load details"));
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id, nav]);

  const toggleSave = async () => {
    setBusy(true);
    try {
      if (isSaved) {
        await apiUnsaveOpp(id);
        setIsSaved(false);
        toast.success("Removed from saved");
      } else {
        await apiSaveOpp(id);
        setIsSaved(true);
        toast.success("Saved to your list");
      }
    } catch (e) {
      toast.error(errMsg(e, "Could not update saved status"));
    } finally {
      setBusy(false);
    }
  };

  const stashExtensionContext = (externalUrl) =>
    stageExtensionContext({
      opportunity_id: id,
      external_url: externalUrl,
    });

  const prepareDraft = async () => {
    setDraftBusy(true);
    try {
      const nextDraft = await apiCreateDraft(id, opp.link);
      setDraft(nextDraft);
      toast.success("Draft started. Next, use Apply to Portal.");
      nav("/drafts");
    } catch (e) {
      toast.error(errMsg(e, "Could not create draft."));
    } finally {
      setDraftBusy(false);
    }
  };

  const openPortal = async () => {
    if (!opp.link) return;
    
    setApplyBusy(true);
    const isInstalled = await checkExtensionInstalled();
    
    if (!isInstalled) {
      setApplyBusy(false);
      setShowExtensionModal(true);
      return;
    }

    try {
      const nextDraft = draft || await apiCreateDraft(id, opp.link);
      setDraft(nextDraft);
      await stashExtensionContext(opp.link);
      window.open(opp.link, "_blank", "noopener,noreferrer");
      toast.success("Portal opened. The extension will use this draft to fill the form.");
    } catch (e) {
      toast.error(errMsg(e, "Could not prepare the extension context."));
    } finally {
      setApplyBusy(false);
    }
  };

  const openPortalBypass = () => {
    if (!opp.link) return;
    window.open(opp.link, "_blank", "noopener,noreferrer");
    toast.info("Opening portal without extension.");
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <Loader2 className="animate-spin text-[var(--accent)] mb-4" size={32} />
        <p className="text-slate-500 font-medium">Loading opportunity details...</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto" data-testid="opportunity-details-page">
      {/* Breadcrumbs */}
      <div className="flex items-center gap-2 text-xs text-slate-500 mb-8 overflow-x-auto whitespace-nowrap pb-2">
        <Link to="/dashboard" className="hover:text-[var(--accent)] transition-colors">Home</Link>
        <ChevronRight size={12} />
        <Link to="/explorer" className="hover:text-[var(--accent)] transition-colors">Explorer</Link>
        <ChevronRight size={12} />
        <span className="text-slate-900 font-medium truncate">{opp.title}</span>
      </div>

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center text-[10px] font-bold text-slate-500">
              {opp.org?.[0] || "P"}
            </div>
            <span className="text-sm font-semibold text-slate-600">{opp.org}</span>
          </div>
          <h1 className="font-display text-3xl md:text-4xl font-bold tracking-tight text-slate-900 leading-tight">
            {opp.title}
          </h1>
        </div>
        <div className="flex gap-3 shrink-0">
          <Button variant="outline" onClick={() => nav(-1)} className="h-11 border-slate-300">
            <ArrowLeft size={16} className="mr-2" /> Back
          </Button>
          <Button onClick={toggleSave} disabled={busy} variant={isSaved ? "default" : "outline"} className={`h-11 ${isSaved ? "bg-[var(--primary)] hover:bg-[var(--primary-hover)]" : "border-slate-300"}`}>
            <Bookmark size={16} className={`mr-2 ${isSaved ? "fill-current" : ""}`} />
            {isSaved ? "Saved" : "Save"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-8">
          {/* Description Section */}
          <Section icon={Info} title="Description" aiAction="Summarize">
            <p className="text-slate-600 leading-relaxed whitespace-pre-wrap">
              {opp.summary || "No description available."}
            </p>
          </Section>

          {/* Eligibility Section */}
          <div id="eligibility-section" className="scroll-mt-24 transition-all duration-500 rounded-2xl">
            <Section icon={ShieldCheck} title="Eligibility" aiAction="Check Fit">
            <div className="space-y-4">
              {opp.eligibility ? (
                <ul className="space-y-3">
                  {opp.eligibility.split(/(?<=[.!?])\s+/).filter(Boolean).map((sentence, i) => (
                    <li key={i} className="flex items-start gap-3 text-slate-600">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-2 shrink-0" />
                      <span>{sentence}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-slate-500 italic">Standard eligibility rules apply. Please check official guidelines.</p>
              )}
              <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-lg flex gap-3 items-start mt-2">
                <Sparkles size={16} className="text-[var(--accent)] mt-0.5 shrink-0" />
                <p className="text-xs text-[var(--accent)] leading-relaxed">
                  <strong>AI Insight:</strong> Based on your sector ({opp.sectors?.join(", ")}), you appear to be a strong candidate for this program.
                </p>
              </div>
            </div>
            </Section>
          </div>

          {/* Benefits Section */}
          <Section icon={Gift} title="Benefits & Funding">
            {opp.benefits?.length > 0 ? (
              <ul className="space-y-3">
                {opp.benefits.map((b, i) => (
                  <li key={i} className="flex items-start gap-3 text-slate-600">
                    <CheckCircle2 size={16} className="text-[var(--accent)] mt-1 shrink-0" />
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-slate-500 italic">No specific benefits listed. Check official application for details.</p>
            )}
          </Section>

          {/* Requirements Section */}
          <Section icon={ListChecks} title="Submission Requirements">
            <p className="text-slate-600 leading-relaxed">
              Standard submission usually requires a pitch deck, financial projections, and technical roadmap.
            </p>
          </Section>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Match Score Card */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            className="bg-[var(--primary)] text-white rounded-2xl p-8 text-center shadow-xl relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 p-4 opacity-10">
              <Sparkles size={120} />
            </div>
            <div className="relative z-10">
              <div className="text-xs uppercase tracking-[0.2em] text-emerald-400 font-bold mb-2">Match Score</div>
              <div className="text-6xl font-display font-bold mb-2">{opp.match || 0}%</div>
              <p className="text-slate-400 text-sm leading-relaxed px-4">
                High alignment with your tech stack and stage.
              </p>
            </div>
          </motion.div>

          {/* Snapshot Card */}
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm sticky top-24">
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50">
              <h3 className="font-bold text-sm text-slate-900">Program Snapshot</h3>
            </div>
            <div className="p-6 space-y-4">
              <SnapshotItem icon={Calendar} label="Deadline" value={opp.deadline || "Rolling"} color="text-[var(--accent)]" />
              <SnapshotItem icon={DollarSign} label="Funding" value={opp.amount || "Variable"} color="text-[var(--accent)]" />
              <SnapshotItem icon={MapPin} label="Location" value={opp.location || "Global / Remote"} />
              <SnapshotItem icon={Info} label="Type" value={opp.type || "Grant"} />
            </div>
            <div className="border-t border-slate-100 px-6 py-5">
              <h4 className="text-xs uppercase tracking-[0.18em] text-slate-500 font-bold">Application Journey</h4>
              <div className="mt-4 space-y-3">
                <JourneyStep icon={FileEdit} title={draft ? "Draft ready" : "Start draft"} text={draft ? "Your draft workspace is ready to review." : "Create the workspace for this opportunity."} />
                <JourneyStep icon={ExternalLink} title="Apply to portal" text="Open the official portal with the FundMe extension ready to fill forms." />
                <JourneyStep icon={CheckCircle2} title="Review and submit" text="Check answers and submit manually on the portal." />
              </div>
            </div>
            <div className="p-6 pt-2 space-y-3">
              <Button
                onClick={draft ? () => nav(`/drafts/${draft.draft_id}?review=true`) : prepareDraft}
                disabled={draftBusy}
                variant={draft ? "outline" : "default"}
                className={draft
                  ? "w-full h-12 border-slate-200 hover:bg-slate-50 text-slate-700 hover:text-slate-700 font-semibold rounded-xl disabled:opacity-60"
                  : "w-full h-12 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white font-semibold rounded-xl btn-press shadow-lg shadow-emerald-200/40 disabled:opacity-60"}
              >
                {draftBusy ? <Loader2 size={16} className="mr-2 animate-spin" /> : draft ? <CheckCircle2 size={16} className="mr-2" /> : <FileEdit size={16} className="mr-2" />}
                {draft ? "Review Draft" : "Start Draft"}
              </Button>
              {opp.link && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={openPortal}
                  disabled={applyBusy}
                  className="w-full h-12 border-slate-200 hover:bg-slate-50 text-slate-700 hover:text-slate-700 font-semibold rounded-xl disabled:opacity-60"
                  data-testid="apply-portal-btn"
                >
                  {applyBusy ? <Loader2 size={16} className="mr-2 animate-spin" /> : null}
                  Apply to Portal <ExternalLink size={16} className="ml-2" />
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
      <ExtensionInstallModal 
        open={showExtensionModal} 
        onOpenChange={setShowExtensionModal}
        onVerified={openPortal}
        onIgnore={openPortalBypass}
      />
    </div>
  );
}

function Section({ icon: Icon, title, children, aiAction }) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-8 shadow-sm group hover:border-slate-300 transition-colors">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[var(--primary-light)] text-[var(--accent)]">
            <Icon size={20} />
          </div>
          <h2 className="font-display text-xl font-bold text-slate-900">{title}</h2>
        </div>
        {aiAction && (
          <Button variant="ghost" size="sm" className="text-xs font-bold text-[var(--accent)] hover:bg-[var(--primary-light)] rounded-lg">
            <Sparkles size={14} className="mr-1.5" /> {aiAction}
          </Button>
        )}
      </div>
      {children}
    </div>
  );
}

function SnapshotItem({ icon: Icon, label, value, color = "text-slate-900" }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2.5 text-slate-500">
        <Icon size={16} strokeWidth={2} />
        <span className="text-xs font-medium">{label}</span>
      </div>
      <span className={`text-sm font-bold ${color}`}>{value}</span>
    </div>
  );
}

function JourneyStep({ icon: Icon, title, text }) {
  return (
    <div className="flex gap-3">
      <div className="mt-0.5 h-7 w-7 rounded-md bg-[var(--primary-light)] text-[var(--accent)] flex items-center justify-center shrink-0">
        <Icon size={14} />
      </div>
      <div>
        <div className="text-sm font-semibold text-slate-900">{title}</div>
        <p className="mt-0.5 text-xs leading-snug text-slate-500">{text}</p>
      </div>
    </div>
  );
}

