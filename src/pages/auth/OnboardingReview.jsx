import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Sparkles, Edit3, Check, ArrowRight, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import AuthShell from "./AuthShell";
import { toast } from "sonner";
import { apiSaveProfile, errMsg } from "@/lib/api";

const FALLBACK = {
  startup_name: "",
  sector: "",
  stage: "",
  startup_overview: "",
  problem_statement: "",
  solution_summary: "",
  target_customers: "",
  business_model: "",
};

export default function OnboardingReview() {
  const nav = useNavigate();
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [profile, setProfile] = useState(FALLBACK);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("fm_ai_profile");
      if (raw) setProfile({ ...FALLBACK, ...JSON.parse(raw) });
    } catch {}
  }, []);

  const update = (k, v) => setProfile((p) => ({ ...p, [k]: v }));

  const finish = async () => {
    setBusy(true);
    try {
      await apiSaveProfile(profile);
      sessionStorage.removeItem("fm_ai_profile");
      toast.success("Profile saved — welcome to FundMe");
      nav("/dashboard", { replace: true });
    } catch (e) {
      toast.error(errMsg(e, "Failed to save profile."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell
      eyebrow="Step 2 of 2 · Review profile"
      title={<>Review your AI-built <span className="font-serif-display text-emerald-700">profile</span>.</>}
      sub="Edit anything that doesn't sound like you. This profile powers every match and AI draft."
    >
      <motion.div
        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45 }}
        data-testid="onboarding-review-page"
      >
        <div className="flex items-center justify-between mb-6">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold">
            <Sparkles size={12} /> AI generated · ready to review
          </div>
          <Button variant={editing ? "default" : "outline"} onClick={() => setEditing(!editing)}
            className={`rounded-md h-10 ${editing ? "bg-emerald-700 hover:bg-emerald-800 text-white" : "border-slate-300"}`}
            data-testid="toggle-edit">
            {editing ? <><Check size={14} className="mr-2" /> Done editing</> : <><Edit3 size={14} className="mr-2" /> Edit fields</>}
          </Button>
        </div>

        <div className="bg-white border border-slate-200 divide-y divide-slate-100">
          <Field label="Startup name" editing={editing} value={profile.startup_name} onChange={(v) => update("startup_name", v)} testid="rev-name" />
          <div className="grid grid-cols-2 divide-x divide-slate-100">
            <Field label="Sector" editing={editing} value={profile.sector} onChange={(v) => update("sector", v)}
              options={["AgriTech", "AI / ML", "DeepTech", "FinTech", "HealthTech", "Climate / Energy", "Smart Cities"]} testid="rev-sector" />
            <Field label="Stage" editing={editing} value={profile.stage} onChange={(v) => update("stage", v)}
              options={["Idea", "MVP", "Early Revenue", "Growth", "PMF", "Scale"]} testid="rev-stage" />
          </div>
          <Field label="Startup overview" multiline editing={editing} value={profile.startup_overview} onChange={(v) => update("startup_overview", v)} testid="rev-overview" />
          <Field label="Problem statement" multiline editing={editing} value={profile.problem_statement} onChange={(v) => update("problem_statement", v)} testid="rev-problem" />
          <Field label="Solution summary" multiline editing={editing} value={profile.solution_summary} onChange={(v) => update("solution_summary", v)} testid="rev-solution" />
          <Field label="Target customers" multiline editing={editing} value={profile.target_customers} onChange={(v) => update("target_customers", v)} testid="rev-users" />
          <Field label="Business model" multiline editing={editing} value={profile.business_model} onChange={(v) => update("business_model", v)} testid="rev-model" />
        </div>

        <Button onClick={finish} disabled={busy}
          className="mt-7 w-full h-12 rounded-md bg-slate-900 hover:bg-slate-800 text-white font-medium btn-press disabled:opacity-60"
          data-testid="finish-onboarding">
          {busy ? <><Loader2 size={14} className="mr-2 animate-spin" /> Saving…</> : <>Save and go to dashboard <ArrowRight size={14} className="ml-2" /></>}
        </Button>
        <p className="mt-3 text-xs text-slate-500 text-center">You can refine this any time from your Startup Profile page.</p>
      </motion.div>
    </AuthShell>
  );
}

function Field({ label, value, onChange, editing, multiline, options, testid }) {
  const v = value || "";
  return (
    <div className="p-6">
      <Label className="text-[10px] uppercase tracking-[0.18em] text-slate-500 font-bold mb-2 block">{label}</Label>
      {!editing ? (
        <div className="text-sm text-slate-800 leading-relaxed whitespace-pre-wrap" data-testid={`view-${testid}`}>{v || <span className="text-slate-400 italic">Not provided</span>}</div>
      ) : options ? (
        <Select value={v} onValueChange={onChange}>
          <SelectTrigger className="h-11 rounded-md" data-testid={testid}><SelectValue placeholder="Select…" /></SelectTrigger>
          <SelectContent>{options.map((x) => <SelectItem key={x} value={x}>{x}</SelectItem>)}</SelectContent>
        </Select>
      ) : multiline ? (
        <Textarea rows={3} value={v} onChange={(e) => onChange(e.target.value)} className="rounded-md" data-testid={testid} />
      ) : (
        <Input value={v} onChange={(e) => onChange(e.target.value)} className="h-11 rounded-md" data-testid={testid} />
      )}
    </div>
  );
}
