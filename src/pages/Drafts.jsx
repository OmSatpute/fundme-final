import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ExternalLink, FileText, CheckCircle2, Eye, Loader2, PencilLine, FileEdit } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { ExtensionInstallModal } from "@/components/ExtensionInstallModal";
import { apiListDrafts, apiTrackApplication, errMsg } from "@/lib/api";
import { getApplyLink, stageExtensionContext } from "@/lib/applyFlow";
import { checkExtensionInstalled } from "@/lib/utils";

const STATUS_STYLES = {
  "IN PROGRESS": "bg-[var(--primary-light)] text-[var(--accent)] border-[var(--primary-light)]",
  REVIEW: "bg-[var(--primary-light)] text-[var(--accent)] border-[var(--primary-light)]",
  APPLIED: "bg-slate-100 text-slate-800 border-slate-300",
};

const formatEditedAt = (value) => {
  if (!value) return "Updated recently";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return `Updated ${new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date)}`;
};

export default function Drafts() {
  const nav = useNavigate();
  const [drafts, setDrafts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [portalBusyId, setPortalBusyId] = useState(null);
  const [pendingDraft, setPendingDraft] = useState(null);
  const [showExtensionModal, setShowExtensionModal] = useState(false);

  const reload = () => {
    setLoading(true);
    apiListDrafts().then((data) => {
      setDrafts(data);

      const pendingDraftId = sessionStorage.getItem("FUNDME_EXT_PENDING_DRAFT");
      if (sessionStorage.getItem("FUNDME_EXT_RELOAD") === window.location.pathname && pendingDraftId) {
        sessionStorage.removeItem("FUNDME_EXT_RELOAD");
        sessionStorage.removeItem("FUNDME_EXT_PENDING_DRAFT");
        setTimeout(() => {
          const btn = document.querySelector(`[data-testid="apply-portal-${pendingDraftId}"]`);
          if (btn) btn.click();
        }, 800);
      }
    }).catch(() => setDrafts([])).finally(() => setLoading(false));
  };

  useEffect(reload, []);

  const markApplied = async (d) => {
    setBusyId(d.draft_id);
    try {
      await apiTrackApplication({ opportunity_id: d.opportunity_id, deadline: d.deadline, status: "applied" });
      toast.success("Marked as Applied - moved to Applications");
      reload();
    } catch (e) {
      toast.error(errMsg(e, "Could not mark applied."));
    } finally {
      setBusyId(null);
    }
  };

  const applyToPortal = async (d, { skipInstallCheck = false } = {}) => {
    const applyLink = getApplyLink(d);
    if (!applyLink) {
      toast.error("No portal link is available for this draft.");
      return;
    }

    setPortalBusyId(d.draft_id);
    try {
      if (!skipInstallCheck) {
        const isInstalled = await checkExtensionInstalled();
        if (!isInstalled) {
          setPendingDraft(d);
          sessionStorage.setItem("FUNDME_EXT_PENDING_DRAFT", d.draft_id);
          setShowExtensionModal(true);
          return;
        }
      }

      await stageExtensionContext({ opportunity_id: d.opportunity_id, external_url: applyLink });
      window.open(applyLink, "_blank", "noopener,noreferrer");
      toast.success("Portal opened. The extension will fill from this draft when the form appears.");
    } catch (e) {
      toast.error(errMsg(e, "Could not prepare the extension context."));
    } finally {
      setPortalBusyId(null);
    }
  };

  const applyWithoutExtension = () => {
    const applyLink = getApplyLink(pendingDraft);
    if (!applyLink) return;
    window.open(applyLink, "_blank", "noopener,noreferrer");
    toast.info("Opening portal without extension.");
  };

  return (
    <div className="max-w-5xl" data-testid="drafts-page">
      <div className="mb-10">
        <div className="text-[10px] uppercase tracking-[0.22em] text-[var(--accent)] font-bold">AI-assisted writing</div>
        <h1 className="mt-2 font-display text-4xl md:text-5xl font-bold tracking-tight">Application Drafts</h1>
        <p className="mt-3 text-slate-500">Start a draft, use Apply to Portal with the extension, then return here to review and mark the application applied.</p>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="animate-spin text-[var(--accent)]" /></div>
      ) : drafts.length === 0 ? (
        <div className="border border-dashed border-slate-300 p-16 text-center bg-white">
          <FileText size={28} className="mx-auto text-slate-400" />
          <div className="mt-4 font-semibold">No drafts yet</div>
          <div className="mt-2 text-sm text-slate-500">Open the Explorer and click <strong>Start Draft</strong> on any opportunity.</div>
        </div>
      ) : (
        <div className="space-y-5">
          {drafts.map((d, i) => (
            <motion.div
              key={d.draft_id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: i * 0.06 }}
              className="bg-white border border-slate-200 hover:border-slate-300 transition-colors overflow-hidden"
              data-testid={`draft-${d.draft_id}`}
            >
              <div className="h-1 bg-[var(--accent)]" />
              <div className="p-6">
                <div className="flex items-start justify-between gap-6 flex-wrap">
                  <div className="flex-1 min-w-[260px]">
                    <div className="flex items-center gap-3 flex-wrap">
                      <h3 className="font-display text-xl font-semibold">{d.opportunity_title}</h3>
                      <span className={`text-[11px] font-bold px-2 py-1 rounded-full border tracking-wide ${STATUS_STYLES[d.status] || STATUS_STYLES["IN PROGRESS"]}`}>{d.status}</span>
                    </div>
                    <div className="mt-1 text-sm text-slate-500">Draft ID: {d.draft_id}</div>
                    <div className="mt-1 text-xs text-slate-500">{formatEditedAt(d.last_edited)}</div>
                  </div>
                  <div className="w-full md:w-72">
                    <div className="flex justify-between text-xs text-slate-500 mb-1.5">
                      <span>AI completion</span><span className="font-semibold text-slate-900" data-testid={`draft-progress-${d.draft_id}`}>{d.progress}%</span>
                    </div>
                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <motion.div initial={{ width: 0 }} animate={{ width: `${d.progress}%` }} transition={{ duration: 1, delay: 0.2 }} className="h-full bg-[var(--accent)]" />
                    </div>
                  </div>
                </div>

                <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-2 text-xs text-slate-600">
                  <WorkflowStep icon={FileEdit} title="Draft started" text="Answers live here." />
                  <WorkflowStep icon={ExternalLink} title="Fill portal" text="Extension reads this draft." />
                  <WorkflowStep icon={CheckCircle2} title="Review and submit" text="Submit manually, then track it." />
                </div>

                <div className="mt-6 grid grid-cols-1 sm:grid-cols-4 gap-2">
                  <Button
                    className="h-11 rounded-md bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white font-medium btn-press disabled:opacity-60"
                    data-testid={`apply-portal-${d.draft_id}`}
                    disabled={portalBusyId === d.draft_id || !getApplyLink(d)}
                    onClick={() => applyToPortal(d)}
                  >
                    {portalBusyId === d.draft_id ? <Loader2 size={14} className="mr-2 animate-spin" /> : <ExternalLink size={14} className="mr-2" />}
                    Apply to Portal
                  </Button>
                  <Button
                    variant="outline"
                    className="h-11 rounded-md border-slate-300 hover:bg-slate-50 text-slate-900 hover:text-slate-900 btn-press"
                    data-testid={`edit-${d.draft_id}`}
                    onClick={() => nav(`/drafts/${d.draft_id}`)}
                  >
                    <PencilLine size={14} className="mr-2" /> Edit Draft
                  </Button>
                  <Button
                    variant="outline"
                    className="h-11 rounded-md border-slate-300 hover:bg-slate-50 text-slate-900 hover:text-slate-900 btn-press"
                    data-testid={`review-${d.draft_id}`}
                    onClick={() => nav(`/drafts/${d.draft_id}?review=true`)}
                  >
                    <Eye size={14} className="mr-2" /> Review Draft
                  </Button>
                  <Button
                    variant="outline"
                    disabled={busyId === d.draft_id}
                    className="h-11 rounded-md border-[var(--accent)]/30 bg-[var(--primary-light)]/50 hover:bg-[var(--primary-light)] text-[var(--accent)] hover:text-[var(--accent)] btn-press disabled:opacity-60"
                    data-testid={`mark-applied-${d.draft_id}`}
                    onClick={() => markApplied(d)}
                  >
                    {busyId === d.draft_id ? <Loader2 size={14} className="mr-2 animate-spin" /> : <CheckCircle2 size={14} className="mr-2" />} Mark Applied
                  </Button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      <ExtensionInstallModal
        open={showExtensionModal}
        onOpenChange={setShowExtensionModal}
        onVerified={() => pendingDraft && applyToPortal(pendingDraft, { skipInstallCheck: true })}
        onIgnore={applyWithoutExtension}
      />
    </div>
  );
}

function WorkflowStep({ icon: Icon, title, text }) {
  return (
    <div className="flex items-start gap-2 rounded-md bg-slate-50 px-3 py-2">
      <Icon size={14} className="mt-0.5 text-[var(--accent)] shrink-0" />
      <div>
        <div className="font-semibold text-slate-900">{title}</div>
        <div className="mt-0.5 leading-snug">{text}</div>
      </div>
    </div>
  );
}
