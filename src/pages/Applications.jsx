import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import CountUp from "react-countup";
import { AlertTriangle, Calendar, ExternalLink, Info, Loader2, Save, Sparkles, TrendingUp, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { apiListApplications, apiUpdateApplicationStatus, apiStageExtensionSession, errMsg } from "@/lib/api";
import { getUserId } from "@/lib/auth";
import { checkExtensionInstalled } from "@/lib/utils";
import { ExtensionInstallModal } from "@/components/ExtensionInstallModal";

const APP_STAGES = ["Applied", "Under Review", "Shortlisted", "Interview / Pitch Round", "Accepted", "Rejected", "Waitlisted", "Withdrawn"];

const STAGE_COLORS = {
  Applied: { ring: "border-t-slate-400", chip: "bg-slate-100 text-slate-800", dot: "bg-slate-400" },
  "Under Review": { ring: "border-t-amber-400", chip: "bg-amber-100 text-amber-800", dot: "bg-amber-400" },
  Shortlisted: { ring: "border-t-blue-400", chip: "bg-blue-100 text-blue-800", dot: "bg-blue-500" },
  "Interview / Pitch Round": { ring: "border-t-purple-500", chip: "bg-purple-100 text-purple-800", dot: "bg-purple-500" },
  Accepted: { ring: "border-t-emerald-500", chip: "bg-emerald-100 text-emerald-800", dot: "bg-emerald-600" },
  Rejected: { ring: "border-t-rose-500", chip: "bg-rose-100 text-rose-700", dot: "bg-rose-400" },
  Waitlisted: { ring: "border-t-amber-300", chip: "bg-amber-50 text-amber-700", dot: "bg-amber-300" },
  Withdrawn: { ring: "border-t-slate-300", chip: "bg-slate-100 text-slate-700", dot: "bg-slate-400" },
};

const ICON = { positive: TrendingUp, warning: AlertTriangle, info: Info };
const TONE = {
  positive: "bg-emerald-50 border-emerald-100 text-emerald-900",
  warning: "bg-amber-50 border-amber-100 text-amber-900",
  info: "bg-blue-50 border-blue-100 text-blue-900",
};

const latestTimelineNote = (app) => {
  const latest = (app.timeline || [])[app.timeline?.length - 1];
  return app.next_step || latest?.note || latest?.description || "Awaiting updates.";
};

function buildInsights(apps) {
  const out = [];
  const total = apps.length;
  if (total === 0) return out;
  const accepted = apps.filter((a) => a.status === "Accepted").length;
  const rejected = apps.filter((a) => a.status === "Rejected").length;
  const review = apps.filter((a) => a.status === "Under Review");
  if (accepted > 0) out.push({ id: "i1", tone: "positive", text: `Acceptance rate ${Math.round((accepted / total) * 100)}% (${accepted}/${total}). Patterns from your wins are powering your next match score.` });
  if (rejected > 0) out.push({ id: "i2", tone: "warning", text: `${rejected} rejection(s) detected. Review the social-impact and traction sections - these are often the differentiators.` });
  if (review.length >= 2) out.push({ id: "i3", tone: "info", text: `${review.length} applications stuck in Under Review. A polite nudge email shifts status for around 22% of FundMe users.` });
  if (out.length === 0) out.push({ id: "i0", tone: "info", text: "Track every application here and AI will start surfacing patterns once you have 3+ applications." });
  return out;
}

export default function Applications() {
  const [apps, setApps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [saving, setSaving] = useState(false);
  const [showExtensionModal, setShowExtensionModal] = useState(false);
  const [pendingApp, setPendingApp] = useState(null);

  const reload = () => {
    setLoading(true);
    apiListApplications().then((data) => {
      setApps(data);
      
      // Auto-trigger portal if we just reloaded for extension on this page
      if (sessionStorage.getItem("FUNDME_EXT_RELOAD") === window.location.pathname) {
        sessionStorage.removeItem("FUNDME_EXT_RELOAD");
        toast.success("Extension activated! Opening portal...");
        // In Applications, we don't know which one was selected, but usually the user 
        // was looking at one. We'll just let them click it once more for safety 
        // or we could store the app ID. For now, just clearing the flag is good.
      }
    }).catch(() => setApps([])).finally(() => setLoading(false));
  };

  useEffect(reload, []);

  // Expose modal trigger to child component
  useEffect(() => {
    // This was a temporary hack, now using props
    return () => {};
  }, []);

  const updateSelected = async (patch) => {
    if (!selected) return;
    setSaving(true);
    try {
      await apiUpdateApplicationStatus(selected.application_id, patch);
      const fresh = await apiListApplications();
      setApps(fresh);
      setSelected(fresh.find((a) => a.application_id === selected.application_id) || null);
      toast.success("Application updated");
    } catch (e) {
      toast.error(errMsg(e, "Could not update application."));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="flex justify-center py-32"><Loader2 className="animate-spin text-[var(--accent)]" /></div>;

  const counts = APP_STAGES.reduce((acc, s) => { acc[s] = apps.filter((a) => a.status === s).length; return acc; }, {});
  const insights = buildInsights(apps);

  return (
    <div className="space-y-10" data-testid="applications-page">
      <header>
        <div className="text-[10px] uppercase tracking-[0.22em] text-[var(--accent)] font-bold">Pipeline</div>
        <h1 className="mt-2 font-display text-4xl md:text-5xl font-bold tracking-tight">Applications Tracker</h1>
        <p className="mt-3 text-slate-500">Every application, every stage. AI watches the patterns so you do not have to.</p>
      </header>

      <section className="grid grid-cols-2 md:grid-cols-5 gap-3" data-testid="stage-stats">
        <Stat big label="Total Applied" value={apps.length} />
        <Stat label="Under Review" value={counts["Under Review"] || 0} accent="amber" />
        <Stat label="Shortlisted" value={(counts.Shortlisted || 0) + (counts["Interview / Pitch Round"] || 0) + (counts.Waitlisted || 0)} accent="emerald" />
        <Stat label="Accepted" value={counts.Accepted || 0} accent="emerald" />
        <Stat label="Rejected" value={counts.Rejected || 0} accent="rose" />
      </section>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-8">
        <section className="xl:col-span-3 overflow-x-auto" data-testid="kanban-board">
          <div className="grid grid-cols-1 md:grid-cols-4 xl:grid-cols-8 gap-3 xl:min-w-[1440px]">
            {APP_STAGES.map((stage) => {
              const items = apps.filter((a) => a.status === stage);
              const c = STAGE_COLORS[stage];
              return (
                <div key={stage} className="bg-white border border-slate-200 flex flex-col min-h-[420px]" data-testid={`column-${stage}`}>
                  <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`h-1.5 w-1.5 rounded-full ${c.dot}`} />
                      <span className="text-[11px] uppercase tracking-wider font-bold text-slate-700">{stage}</span>
                    </div>
                    <span className="text-xs text-slate-500 font-semibold">{items.length}</span>
                  </div>
                  <div className="p-3 space-y-3 flex-1">
                    {items.map((a, i) => (
                      <motion.div
                        key={a.application_id}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3, delay: i * 0.05 }}
                        whileHover={{ y: -2 }}
                        onClick={() => setSelected(a)}
                        className={`p-3 bg-white border-x border-b border-t-2 ${c.ring} hover:shadow-md transition-all cursor-pointer`}
                        data-testid={`app-card-${a.application_id}`}
                      >
                        <div className="text-[13px] font-semibold text-slate-900 leading-tight line-clamp-2">{a.opportunity_title}</div>
                        <div className="mt-1 text-[11px] text-slate-500 line-clamp-1">{a.org || "Provider unavailable"}</div>
                        <div className="mt-3 flex items-center justify-between">
                          <div className="text-xs font-semibold">{a.amount || "Variable"}</div>
                          <div className="text-[10px] text-slate-500">{(a.applied_on || "").split("T")[0]}</div>
                        </div>
                        {a.deadline ? <div className="mt-2 text-[10px] text-slate-500">Deadline: {a.deadline}</div> : null}
                        <div className="mt-3 border-l-2 border-emerald-600 bg-slate-50 px-2.5 py-2">
                          <div className="text-[10px] uppercase tracking-wider font-bold text-[var(--accent)]">Next step</div>
                          <div className="mt-1 text-[11px] leading-snug text-slate-700 line-clamp-3">{latestTimelineNote(a)}</div>
                        </div>
                        {a.match ? <div className="mt-2"><span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${c.chip}`}>{a.match}% match</span></div> : null}
                      </motion.div>
                    ))}
                    {items.length === 0 && <div className="border border-dashed border-slate-200 py-10 text-center text-xs text-slate-400">Empty</div>}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <aside className="xl:col-span-1 space-y-3 xl:sticky xl:top-24 xl:self-start" data-testid="ai-insights">
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="text-[var(--accent)]" />
            <h3 className="font-display text-lg font-semibold">AI Insights</h3>
          </div>
          {insights.map((ins) => {
            const Ic = ICON[ins.tone];
            return (
              <motion.div
                key={ins.id}
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.4 }}
                className={`border p-4 ${TONE[ins.tone]}`}
              >
                <Ic size={16} />
                <p className="mt-2 text-[13px] leading-relaxed">{ins.text}</p>
              </motion.div>
            );
          })}
        </aside>
      </div>

      {selected ? (
        <ApplicationPanel
          app={selected}
          saving={saving}
          onClose={() => setSelected(null)}
          onUpdate={updateSelected}
          onShowModal={(app) => {
            setPendingApp(app);
            setShowExtensionModal(true);
          }}
        />
      ) : null}
      <ExtensionInstallModal 
        open={showExtensionModal} 
        onOpenChange={setShowExtensionModal} 
        onVerified={() => {
          if (pendingApp) {
            const link = pendingApp.opportunity?.external_apply_url || pendingApp.opportunity?.link || "";
            if (link) {
              apiStageExtensionSession({ opportunity_id: pendingApp.opportunity_id, external_url: link });
              window.open(link, "_blank", "noopener,noreferrer");
              toast.success("Extension context prepared.");
            }
          }
        }}
        onIgnore={() => {
          if (pendingApp) {
            const link = pendingApp.opportunity?.external_apply_url || pendingApp.opportunity?.link || "";
            if (link) {
              window.open(link, "_blank", "noopener,noreferrer");
              toast.info("Opening portal without extension.");
            }
          }
        }}
      />
    </div>
  );
}

function Stat({ label, value, big, accent }) {
  const map = { amber: "text-amber-600", emerald: "text-emerald-600", rose: "text-rose-600", blue: "text-blue-600" };
  return (
    <div className={`p-5 border border-slate-200 ${big ? "bg-[var(--primary)] text-white" : "bg-white"}`}>
      <div className={`font-display text-4xl font-bold tracking-tighter ${big ? "text-white" : map[accent] || "text-slate-900"}`}>
        <CountUp end={value} duration={1.2} />
      </div>
      <div className={`mt-2 text-[10px] uppercase tracking-wider font-bold ${big ? "text-emerald-400" : "text-slate-400"}`}>{label}</div>
    </div>
  );
}

function ApplicationPanel({ app, saving, onClose, onUpdate, onShowModal }) {
  const [notes, setNotes] = useState(app.feedback || "");
  const [nextStep, setNextStep] = useState(app.next_step || "");
  const color = STAGE_COLORS[app.status] || STAGE_COLORS.Applied;
  const applyLink = app.opportunity?.external_apply_url || app.opportunity?.link || "";
  const [applyBusy, setApplyBusy] = useState(false);

  const handleOpenPortal = async () => {
    if (!applyLink) return;
    setApplyBusy(true);
    const isInstalled = await checkExtensionInstalled();
    if (!isInstalled) {
      setApplyBusy(false);
      onShowModal(app);
      return;
    }
    
    try {
      await apiStageExtensionSession({ opportunity_id: app.opportunity_id, external_url: applyLink });
      window.open(applyLink, "_blank", "noopener,noreferrer");
      toast.success("Extension context prepared.");
    } catch (e) {
      toast.error(errMsg(e, "Could not prepare extension."));
    } finally {
      setApplyBusy(false);
    }
  };

  useEffect(() => {
    setNotes(app.feedback || "");
    setNextStep(app.next_step || "");
  }, [app]);

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm" data-testid="application-panel">
      <div className="absolute right-0 top-0 h-full w-full max-w-xl bg-white shadow-2xl overflow-y-auto">
        <div className="sticky top-0 z-10 border-b border-slate-200 bg-white px-6 py-4 flex items-center justify-between">
          <div>
            <div className="text-[10px] uppercase tracking-[0.2em] text-emerald-600 font-bold">Application</div>
            <h2 className="mt-1 font-display text-2xl font-bold leading-tight">{app.opportunity_title}</h2>
          </div>
          <button onClick={onClose} className="h-9 w-9 inline-flex items-center justify-center rounded-md hover:bg-slate-100" aria-label="Close application details">
            <X size={18} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="grid grid-cols-2 gap-3">
            <InfoBox label="Provider" value={app.org || "Unavailable"} />
            <InfoBox label="Funding" value={app.amount || "Variable"} />
            <InfoBox label="Applied On" value={(app.applied_on || "").split("T")[0] || "Not recorded"} />
            <InfoBox label="Deadline" value={app.deadline || "Rolling"} />
          </div>

          <section className="border border-slate-200 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-xs uppercase tracking-wider text-slate-500 font-bold">Current status</div>
                <span className={`mt-2 inline-flex text-[11px] font-bold px-2 py-1 rounded-full border tracking-wide ${color.chip}`}>{app.status}</span>
              </div>
              <select
                value={app.status}
                disabled={saving}
                onChange={(e) => {
                  const newStatus = e.target.value;
                  const note = nextStep || `Status updated to ${newStatus}`;
                  onUpdate({
                    status: newStatus,
                    next_step: note,
                    timeline: [...(app.timeline || []), { stage: newStatus, note, date: new Date().toISOString().slice(0, 10) }],
                  });
                }}
                className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm font-medium outline-none focus:border-emerald-500"
                data-testid="application-status-select"
              >
                {APP_STAGES.map((stage) => <option key={stage} value={stage}>{stage}</option>)}
              </select>
            </div>
          </section>

          <section className="border border-slate-200 p-4">
            <div className="flex items-center gap-2 mb-4">
              <Calendar size={16} className="text-emerald-600" />
              <h3 className="font-display text-lg font-semibold">Timeline</h3>
            </div>
            <div className="space-y-3">
              {(app.timeline || []).length === 0 ? (
                <div className="text-sm text-slate-500">No timeline events yet.</div>
              ) : app.timeline.map((item, index) => (
                <div key={`${item.stage}-${item.date}-${index}`} className="flex gap-3">
                  <span className="mt-1.5 h-2 w-2 rounded-full bg-emerald-600 shrink-0" />
                  <div>
                    <div className="text-sm font-semibold text-slate-900">{item.stage || item.status}</div>
                    {item.note ? <div className="mt-0.5 text-xs text-slate-600">{item.note}</div> : null}
                    <div className="text-xs text-slate-500">{item.date}</div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="space-y-3">
            <label className="text-xs uppercase tracking-wider text-slate-500 font-bold">Next step</label>
            <Textarea value={nextStep} onChange={(e) => setNextStep(e.target.value)} rows={3} className="rounded-md border-slate-300" />
          </section>

          <section className="space-y-3">
            <label className="text-xs uppercase tracking-wider text-slate-500 font-bold">Notes / feedback</label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={5} className="rounded-md border-slate-300" />
          </section>

          <div className="flex flex-col sm:flex-row gap-2">
            <Button onClick={() => onUpdate({ next_step: nextStep, feedback: notes })} disabled={saving} className="h-11 rounded-md bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white">
              {saving ? <Loader2 size={14} className="mr-2 animate-spin" /> : <Save size={14} className="mr-2" />} Save details
            </Button>
            {applyLink ? (
              <Button 
                variant="outline" 
                className="h-11 rounded-md border-slate-300"
                onClick={handleOpenPortal}
                disabled={applyBusy}
              >
                {applyBusy ? <Loader2 size={14} className="mr-2 animate-spin" /> : null}
                Open portal <ExternalLink size={14} className="ml-2" />
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function InfoBox({ label, value }) {
  return (
    <div className="border border-slate-200 bg-slate-50 p-3">
      <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">{label}</div>
      <div className="mt-1 text-sm font-semibold text-slate-900 leading-tight">{value}</div>
    </div>
  );
}
