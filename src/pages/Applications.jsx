import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import CountUp from "react-countup";
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  Clock3,
  ExternalLink,
  Flag,
  Info,
  Loader2,
  Save,
  Sparkles,
  TrendingUp,
  UserRound,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ExtensionInstallModal } from "@/components/ExtensionInstallModal";
import { apiListApplications, apiStageExtensionSession, apiUpdateApplicationStatus, errMsg } from "@/lib/api";
import { checkExtensionInstalled } from "@/lib/utils";

const APP_STAGES = ["Applied", "Under Review", "Shortlisted", "Interview / Pitch Round", "Accepted", "Rejected", "Waitlisted", "Withdrawn"];
const TERMINAL_STAGES = new Set(["Accepted", "Rejected", "Withdrawn"]);
const PRIORITIES = ["Low", "Medium", "High"];

const STAGE_COLORS = {
  Applied: { ring: "border-t-slate-400", chip: "bg-slate-100 text-slate-800 border-slate-200", dot: "bg-slate-400", rail: "border-slate-300 bg-slate-50 text-slate-700" },
  "Under Review": { ring: "border-t-amber-400", chip: "bg-amber-100 text-amber-800 border-amber-200", dot: "bg-amber-400", rail: "border-amber-300 bg-amber-50 text-amber-800" },
  Shortlisted: { ring: "border-t-blue-400", chip: "bg-blue-100 text-blue-800 border-blue-200", dot: "bg-blue-500", rail: "border-blue-300 bg-blue-50 text-blue-800" },
  "Interview / Pitch Round": { ring: "border-t-purple-500", chip: "bg-purple-100 text-purple-800 border-purple-200", dot: "bg-purple-500", rail: "border-purple-300 bg-purple-50 text-purple-800" },
  Accepted: { ring: "border-t-emerald-500", chip: "bg-emerald-100 text-emerald-800 border-emerald-200", dot: "bg-emerald-600", rail: "border-emerald-300 bg-emerald-50 text-emerald-800" },
  Rejected: { ring: "border-t-rose-500", chip: "bg-rose-100 text-rose-700 border-rose-200", dot: "bg-rose-400", rail: "border-rose-300 bg-rose-50 text-rose-800" },
  Waitlisted: { ring: "border-t-orange-400", chip: "bg-orange-100 text-orange-800 border-orange-200", dot: "bg-orange-400", rail: "border-orange-300 bg-orange-50 text-orange-800" },
  Withdrawn: { ring: "border-t-slate-300", chip: "bg-slate-100 text-slate-700 border-slate-200", dot: "bg-slate-400", rail: "border-slate-300 bg-slate-50 text-slate-700" },
};

const ICON = { positive: TrendingUp, warning: AlertTriangle, info: Info };
const TONE = {
  positive: "bg-emerald-50 border-emerald-100 text-emerald-900",
  warning: "bg-amber-50 border-amber-100 text-amber-900",
  info: "bg-blue-50 border-blue-100 text-blue-900",
};

const NEXT_STEP_HINTS = {
  Applied: "Wait for confirmation email",
  "Under Review": "Prepare for potential interview",
  Shortlisted: "Schedule interview or pitch prep",
  "Interview / Pitch Round": "Follow up after the conversation",
  Accepted: "Complete onboarding requirements",
  Rejected: "Capture feedback and improve the next submission",
  Waitlisted: "Share new traction and stay warm with the program team",
  Withdrawn: "Archive learnings and redirect effort",
};

const todayIso = () => new Date().toISOString().slice(0, 10);

function normalizeStageDetails(app) {
  const seed = Object.fromEntries(APP_STAGES.map((stage) => [stage, { date: "", note: "" }]));
  const fromApi = app?.stage_details || {};

  APP_STAGES.forEach((stage) => {
    if (fromApi[stage]) {
      seed[stage] = {
        date: fromApi[stage].date || "",
        note: fromApi[stage].note || "",
      };
    }
  });

  (app?.timeline || []).forEach((entry) => {
    const stage = entry.stage || entry.status;
    if (!stage || !seed[stage]) return;
    seed[stage] = {
      date: entry.date || seed[stage].date,
      note: entry.note || entry.description || seed[stage].note,
    };
  });

  return seed;
}

function buildTimelineFromStageDetails(stageDetails) {
  return APP_STAGES
    .filter((stage) => {
      const item = stageDetails?.[stage];
      return item && (item.date || item.note);
    })
    .map((stage) => ({
      stage,
      date: stageDetails[stage].date || "",
      note: stageDetails[stage].note || "",
    }));
}

function latestTimelineNote(app) {
  const stageDetails = normalizeStageDetails(app);
  const lastStage = [...APP_STAGES].reverse().find((stage) => stageDetails[stage]?.date || stageDetails[stage]?.note);
  return app.next_step || (lastStage ? stageDetails[lastStage].note : "") || "Awaiting updates.";
}

function buildInsights(apps) {
  const out = [];
  const total = apps.length;
  if (total === 0) return out;

  const accepted = apps.filter((a) => a.status === "Accepted").length;
  const rejected = apps.filter((a) => a.status === "Rejected").length;
  const review = apps.filter((a) => a.status === "Under Review");
  const dueFollowUps = apps.filter((a) => a.follow_up_date && a.follow_up_date <= todayIso() && !TERMINAL_STAGES.has(a.status)).length;

  if (accepted > 0) out.push({ id: "i1", tone: "positive", text: `Acceptance rate ${Math.round((accepted / total) * 100)}% (${accepted}/${total}). Your strongest patterns are now visible across the whole pipeline.` });
  if (rejected > 0) out.push({ id: "i2", tone: "warning", text: `${rejected} rejection(s) logged. Capture reviewer notes here so the next draft can improve against real feedback, not guesswork.` });
  if (review.length >= 2) out.push({ id: "i3", tone: "info", text: `${review.length} applications are under review. Use follow-up dates and phase notes so those opportunities do not go stale.` });
  if (dueFollowUps > 0) out.push({ id: "i4", tone: "warning", text: `${dueFollowUps} follow-up action(s) are due today. This is exactly where a production-ready tracker should keep the team honest.` });
  if (out.length === 0) out.push({ id: "i0", tone: "info", text: "Track every phase per opportunity and FundMe will start surfacing much better operating patterns once the pipeline fills out." });

  return out;
}

export default function Applications() {
  const [apps, setApps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [savingId, setSavingId] = useState(null);
  const [showExtensionModal, setShowExtensionModal] = useState(false);
  const [pendingApp, setPendingApp] = useState(null);

  const reload = () => {
    setLoading(true);
    apiListApplications()
      .then((data) => {
        setApps(data);
        setSelected((current) => (current ? data.find((app) => app.application_id === current.application_id) || null : null));

        if (sessionStorage.getItem("FUNDME_EXT_RELOAD") === window.location.pathname) {
          sessionStorage.removeItem("FUNDME_EXT_RELOAD");
          toast.success("Extension activated. Your portal flow is ready again.");
        }
      })
      .catch(() => setApps([]))
      .finally(() => setLoading(false));
  };

  useEffect(reload, []);

  const saveApplication = async (applicationId, patch, successMessage = "Application updated") => {
    setSavingId(applicationId);
    try {
      await apiUpdateApplicationStatus(applicationId, patch);
      const fresh = await apiListApplications();
      setApps(fresh);
      setSelected((current) => (current ? fresh.find((app) => app.application_id === current.application_id) || null : null));
      toast.success(successMessage);
    } catch (e) {
      toast.error(errMsg(e, "Could not update application."));
    } finally {
      setSavingId(null);
    }
  };

  const stats = useMemo(() => {
    const breakdown = APP_STAGES.reduce((acc, stage) => {
      acc[stage] = apps.filter((app) => app.status === stage).length;
      return acc;
    }, {});
    const dueFollowUps = apps.filter((app) => app.follow_up_date && app.follow_up_date <= todayIso() && !TERMINAL_STAGES.has(app.status)).length;
    const activePipeline = apps.filter((app) => !TERMINAL_STAGES.has(app.status)).length;
    return { breakdown, dueFollowUps, activePipeline };
  }, [apps]);

  const insights = useMemo(() => buildInsights(apps), [apps]);

  if (loading) {
    return <div className="flex justify-center py-32"><Loader2 className="animate-spin text-[var(--accent)]" /></div>;
  }

  return (
    <div className="space-y-10" data-testid="applications-page">
      <header>
        <div className="text-[10px] uppercase tracking-[0.22em] text-[var(--accent)] font-bold">Pipeline</div>
        <h1 className="mt-2 font-display text-4xl md:text-5xl font-bold tracking-tight">Applications Tracker</h1>
        <p className="mt-3 text-slate-500">Every opportunity now carries its own full phase history, follow-ups, and working notes.</p>
      </header>

      <section className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3" data-testid="stage-stats">
        <Stat big label="Total Applied" value={apps.length} />
        <Stat label="Active Pipeline" value={stats.activePipeline} accent="blue" />
        <Stat label="Follow-Ups Due" value={stats.dueFollowUps} accent="amber" />
        <Stat label="Under Review" value={stats.breakdown["Under Review"] || 0} accent="amber" />
        <Stat label="Accepted" value={stats.breakdown.Accepted || 0} accent="emerald" />
        <Stat label="Rejected" value={stats.breakdown.Rejected || 0} accent="rose" />
      </section>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-8">
        <section className="xl:col-span-3 overflow-x-auto" data-testid="kanban-board">
          <div className="grid grid-cols-1 md:grid-cols-4 xl:grid-cols-8 gap-3 xl:min-w-[1560px]">
            {APP_STAGES.map((stage) => {
              const items = apps.filter((a) => a.status === stage);
              const tone = STAGE_COLORS[stage];
              return (
                <div key={stage} className="bg-white border border-slate-200 flex flex-col min-h-[440px]" data-testid={`column-${stage}`}>
                  <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`h-1.5 w-1.5 rounded-full ${tone.dot}`} />
                      <span className="text-[11px] uppercase tracking-wider font-bold text-slate-700">{stage}</span>
                    </div>
                    <span className="text-xs text-slate-500 font-semibold">{items.length}</span>
                  </div>
                  <div className="p-3 space-y-3 flex-1">
                    {items.map((app, index) => (
                      <ApplicationCard
                        key={app.application_id}
                        app={app}
                        index={index}
                        tone={tone}
                        busy={savingId === app.application_id}
                        onOpen={() => setSelected(app)}
                        onQuickStatusChange={(nextStatus) => {
                          const stageDetails = normalizeStageDetails(app);
                          stageDetails[nextStatus] = {
                            ...stageDetails[nextStatus],
                            date: stageDetails[nextStatus].date || todayIso(),
                            note: stageDetails[nextStatus].note || latestTimelineNote(app),
                          };
                          saveApplication(app.application_id, {
                            status: nextStatus,
                            stage_details: stageDetails,
                            next_step: app.next_step || NEXT_STEP_HINTS[nextStatus],
                          }, `Moved to ${nextStatus}`);
                        }}
                      />
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
            <h3 className="font-display text-lg font-semibold">Pipeline Signals</h3>
          </div>
          {insights.map((insight) => {
            const IconComp = ICON[insight.tone];
            return (
              <motion.div
                key={insight.id}
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.4 }}
                className={`border p-4 ${TONE[insight.tone]}`}
              >
                <IconComp size={16} />
                <p className="mt-2 text-[13px] leading-relaxed">{insight.text}</p>
              </motion.div>
            );
          })}
        </aside>
      </div>

      {selected ? (
        <ApplicationPanel
          app={selected}
          saving={savingId === selected.application_id}
          onClose={() => setSelected(null)}
          onUpdate={(patch) => saveApplication(selected.application_id, patch)}
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

function ApplicationCard({ app, index, tone, busy, onOpen, onQuickStatusChange }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
      whileHover={{ y: -2 }}
      onClick={onOpen}
      className={`p-3 bg-white border-x border-b border-t-2 ${tone.ring} hover:shadow-md transition-all cursor-pointer`}
      data-testid={`app-card-${app.application_id}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[13px] font-semibold text-slate-900 leading-tight line-clamp-2">{app.opportunity_title}</div>
          <div className="mt-1 text-[11px] text-slate-500 line-clamp-1">{app.org || "Provider unavailable"}</div>
        </div>
        <span className={`shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${STAGE_COLORS[app.status]?.chip || ""}`}>{app.priority || "Medium"}</span>
      </div>

      <div className="mt-3 flex items-center justify-between">
        <div className="text-xs font-semibold">{app.amount || "Variable"}</div>
        <div className="text-[10px] text-slate-500">{(app.applied_on || "").split("T")[0]}</div>
      </div>

      {app.deadline ? <div className="mt-2 text-[10px] text-slate-500">Deadline: {app.deadline}</div> : null}
      {app.follow_up_date ? <div className="mt-1 text-[10px] text-amber-700">Follow-up: {app.follow_up_date}</div> : null}

      <div className="mt-3 border-l-2 border-emerald-600 bg-slate-50 px-2.5 py-2">
        <div className="text-[10px] uppercase tracking-wider font-bold text-[var(--accent)]">Next step</div>
        <div className="mt-1 text-[11px] leading-snug text-slate-700 line-clamp-3">{latestTimelineNote(app)}</div>
      </div>

      <div className="mt-3" onClick={(e) => e.stopPropagation()}>
        <label className="text-[10px] uppercase tracking-wider font-bold text-slate-500">Phase</label>
        <select
          value={app.status}
          onChange={(e) => onQuickStatusChange(e.target.value)}
          disabled={busy}
          className="mt-1 h-9 w-full rounded-md border border-slate-300 bg-white px-2 text-xs font-medium outline-none focus:border-emerald-500"
        >
          {APP_STAGES.map((stage) => <option key={stage} value={stage}>{stage}</option>)}
        </select>
      </div>

      {app.match ? <div className="mt-2"><span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${tone.chip}`}>{app.match}% match</span></div> : null}
    </motion.div>
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
  const [status, setStatus] = useState(app.status);
  const [notes, setNotes] = useState(app.feedback || "");
  const [nextStep, setNextStep] = useState(app.next_step || "");
  const [followUpDate, setFollowUpDate] = useState(app.follow_up_date || "");
  const [priority, setPriority] = useState(app.priority || "Medium");
  const [owner, setOwner] = useState(app.owner || "");
  const [stageDetails, setStageDetails] = useState(() => normalizeStageDetails(app));
  const [applyBusy, setApplyBusy] = useState(false);

  const tone = STAGE_COLORS[status] || STAGE_COLORS.Applied;
  const applyLink = app.opportunity?.external_apply_url || app.opportunity?.link || "";
  const timeline = useMemo(() => buildTimelineFromStageDetails(stageDetails), [stageDetails]);

  useEffect(() => {
    setStatus(app.status);
    setNotes(app.feedback || "");
    setNextStep(app.next_step || "");
    setFollowUpDate(app.follow_up_date || "");
    setPriority(app.priority || "Medium");
    setOwner(app.owner || "");
    setStageDetails(normalizeStageDetails(app));
  }, [app]);

  const setStageField = (stage, key, value) => {
    setStageDetails((current) => ({
      ...current,
      [stage]: {
        ...current[stage],
        [key]: value,
      },
    }));
  };

  const promoteToStage = (stage) => {
    setStatus(stage);
    setStageDetails((current) => ({
      ...current,
      [stage]: {
        ...current[stage],
        date: current[stage]?.date || todayIso(),
        note: current[stage]?.note || "",
      },
    }));
    setNextStep((current) => current || NEXT_STEP_HINTS[stage] || "");
  };

  const handleSave = () => {
    onUpdate({
      status,
      next_step: nextStep,
      feedback: notes,
      follow_up_date: followUpDate,
      priority,
      owner,
      stage_details: stageDetails,
      timeline,
    });
  };

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

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm" data-testid="application-panel">
      <div className="absolute right-0 top-0 h-full w-full max-w-2xl bg-white shadow-2xl overflow-y-auto">
        <div className="sticky top-0 z-10 border-b border-slate-200 bg-white px-6 py-4 flex items-center justify-between">
          <div>
            <div className="text-[10px] uppercase tracking-[0.2em] text-emerald-600 font-bold">Application workspace</div>
            <h2 className="mt-1 font-display text-2xl font-bold leading-tight">{app.opportunity_title}</h2>
          </div>
          <button onClick={onClose} className="h-9 w-9 inline-flex items-center justify-center rounded-md hover:bg-slate-100" aria-label="Close application details">
            <X size={18} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <InfoBox label="Provider" value={app.org || "Unavailable"} />
            <InfoBox label="Funding" value={app.amount || "Variable"} />
            <InfoBox label="Applied On" value={(app.applied_on || "").split("T")[0] || "Not recorded"} />
            <InfoBox label="Deadline" value={app.deadline || "Rolling"} />
          </div>

          <section className="border border-slate-200 p-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <div className="text-xs uppercase tracking-wider text-slate-500 font-bold">Current status</div>
                <span className={`mt-2 inline-flex text-[11px] font-bold px-2 py-1 rounded-full border tracking-wide ${tone.chip}`}>{status}</span>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <Field label="Priority">
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value)}
                    className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm font-medium outline-none focus:border-emerald-500"
                  >
                    {PRIORITIES.map((item) => <option key={item} value={item}>{item}</option>)}
                  </select>
                </Field>
                <Field label="Follow-up">
                  <Input type="date" value={followUpDate} onChange={(e) => setFollowUpDate(e.target.value)} className="h-10 rounded-md border-slate-300" />
                </Field>
              </div>
            </div>
          </section>

          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 size={16} className="text-emerald-600" />
              <h3 className="font-display text-lg font-semibold">Phase control</h3>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {APP_STAGES.map((stage) => {
                const active = status === stage;
                const stageTone = STAGE_COLORS[stage];
                return (
                  <button
                    key={stage}
                    type="button"
                    onClick={() => promoteToStage(stage)}
                    className={`rounded-md border px-3 py-3 text-left transition-all ${active ? stageTone.rail : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"}`}
                  >
                    <div className="text-xs font-semibold">{stage}</div>
                    <div className="mt-1 text-[11px] opacity-75">{stageDetails[stage]?.date || "Not set"}</div>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="border border-slate-200 p-4 space-y-4">
            <div className="flex items-center gap-2">
              <Calendar size={16} className="text-emerald-600" />
              <h3 className="font-display text-lg font-semibold">Editable phase ledger</h3>
            </div>
            <div className="space-y-4">
              {APP_STAGES.map((stage) => (
                <div key={stage} className="border border-slate-200 rounded-md p-3">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="font-semibold text-slate-900">{stage}</div>
                    <Input
                      type="date"
                      value={stageDetails[stage]?.date || ""}
                      onChange={(e) => setStageField(stage, "date", e.target.value)}
                      className="h-9 w-[180px] rounded-md border-slate-300"
                    />
                  </div>
                  <Textarea
                    value={stageDetails[stage]?.note || ""}
                    onChange={(e) => setStageField(stage, "note", e.target.value)}
                    rows={2}
                    placeholder={`What happened in ${stage.toLowerCase()}?`}
                    className="mt-3 rounded-md border-slate-300"
                  />
                </div>
              ))}
            </div>
          </section>

          <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Next step">
              <Textarea value={nextStep} onChange={(e) => setNextStep(e.target.value)} rows={4} className="rounded-md border-slate-300" />
            </Field>
            <Field label="Owner / contact">
              <Textarea value={owner} onChange={(e) => setOwner(e.target.value)} rows={4} className="rounded-md border-slate-300" placeholder="Person accountable, reviewer name, or partner contact" />
            </Field>
          </section>

          <section className="space-y-3">
            <label className="text-xs uppercase tracking-wider text-slate-500 font-bold">Notes / feedback</label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={5} className="rounded-md border-slate-300" />
          </section>

          <section className="border border-slate-200 p-4">
            <div className="flex items-center gap-2 mb-4">
              <Clock3 size={16} className="text-emerald-600" />
              <h3 className="font-display text-lg font-semibold">Phase history preview</h3>
            </div>
            <div className="space-y-3">
              {timeline.length === 0 ? (
                <div className="text-sm text-slate-500">No phase history recorded yet.</div>
              ) : timeline.map((item, index) => (
                <div key={`${item.stage}-${item.date}-${index}`} className="flex gap-3">
                  <span className={`mt-1.5 h-2 w-2 rounded-full ${STAGE_COLORS[item.stage]?.dot || "bg-slate-400"} shrink-0`} />
                  <div>
                    <div className="text-sm font-semibold text-slate-900">{item.stage}</div>
                    {item.note ? <div className="mt-0.5 text-xs text-slate-600">{item.note}</div> : null}
                    <div className="text-xs text-slate-500">{item.date || "Date not set"}</div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <div className="flex flex-col sm:flex-row gap-2">
            <Button onClick={handleSave} disabled={saving} className="h-11 rounded-md bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white">
              {saving ? <Loader2 size={14} className="mr-2 animate-spin" /> : <Save size={14} className="mr-2" />} Save tracking details
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

function Field({ label, children }) {
  return (
    <div className="space-y-2">
      <label className="text-xs uppercase tracking-wider text-slate-500 font-bold flex items-center gap-1">
        {label === "Priority" ? <Flag size={12} /> : null}
        {label === "Owner / contact" ? <UserRound size={12} /> : null}
        {label === "Follow-up" ? <Clock3 size={12} /> : null}
        {label}
      </label>
      {children}
    </div>
  );
}
