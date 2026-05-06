import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Building2, MapPin, Users, Globe, Sparkles, Save, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { apiGetProfile, apiSaveProfile, errMsg } from "@/lib/api";
import { getUser } from "@/lib/auth";

const SECTIONS = [
  { id: "company", label: "Company", Icon: Building2 },
  { id: "story", label: "Problem & Solution", Icon: Sparkles },
  { id: "traction", label: "Traction & Metrics", Icon: Users },
  { id: "presence", label: "Presence & Links", Icon: Globe },
];

const EMPTY = {
  startup_name: "", sector: "", stage: "", startup_overview: "",
  problem_statement: "", solution_summary: "", target_customers: "",
  business_model: "", traction_summary: "",
  location: "", website: "", founded: "", team_size: "",
  revenue: "", incorporation: "", dpiit: "",
};

export default function StartupProfile() {
  const [active, setActive] = useState("company");
  const [form, setForm] = useState(EMPTY);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const user = getUser();

  useEffect(() => {
    apiGetProfile().then((p) => setForm({ ...EMPTY, ...p })).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const update = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const save = async () => {
    setBusy(true);
    try {
      const payload = { ...form };
      if (payload.team_size) payload.team_size = Number(payload.team_size);
      await apiSaveProfile(payload);
      toast.success("Profile saved");
    } catch (e) {
      toast.error(errMsg(e, "Save failed"));
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <div className="flex justify-center py-32"><Loader2 className="animate-spin text-emerald-600" /></div>;

  return (
    <div className="grid grid-cols-12 gap-10" data-testid="profile-page">
      <aside className="col-span-12 lg:col-span-3 lg:sticky lg:top-24 lg:self-start">
        <div className="text-[10px] uppercase tracking-[0.22em] text-emerald-600 font-bold mb-4">Startup profile</div>
        <div className="space-y-1">
          {SECTIONS.map(({ id, label, Icon }) => (
            <button key={id} onClick={() => setActive(id)} data-testid={`profile-section-${id}`}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-all ${active === id ? "bg-emerald-700 text-white" : "text-slate-700 hover:bg-emerald-50/70"}`}>
              <Icon size={15} strokeWidth={1.75} />
              {label}
            </button>
          ))}
        </div>
        <div className="mt-8 p-5 bg-emerald-50 border border-emerald-200">
          <div className="text-xs text-emerald-900 font-semibold">Why this matters</div>
          <p className="mt-2 text-xs text-emerald-900/80">Every field you fill increases match accuracy. AI uses your profile to draft applications.</p>
        </div>
      </aside>

      <section className="col-span-12 lg:col-span-9">
        <div className="flex items-end justify-between flex-wrap gap-4 mb-8">
          <div className="flex items-center gap-5">
            <div className="h-16 w-16 rounded-full bg-gradient-to-br from-emerald-600 to-emerald-800 text-white flex items-center justify-center text-lg font-bold ring-4 ring-white shadow overflow-hidden">
              {user?.avatar ? (
                <img src={user.avatar} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                (form.startup_name?.[0] || user?.name?.[0] || "F").toUpperCase()
              )}
            </div>
            <div>
              <h1 className="font-display text-3xl md:text-4xl font-bold tracking-tight">{form.startup_name || user?.name || "Your startup"}</h1>
              <div className="mt-1 text-sm text-slate-500 flex items-center gap-3">
                {form.location && <><MapPin size={12} /> {form.location}<span className="text-slate-300">·</span></>}
                {form.stage || "—"} · {form.sector || "—"}
              </div>
            </div>
          </div>
          <Button className="rounded-md bg-emerald-700 hover:bg-emerald-800 text-white h-11 px-5 btn-press" onClick={save} disabled={busy} data-testid="profile-save">
            {busy ? <><Loader2 size={14} className="mr-2 animate-spin" /> Saving</> : <><Save size={14} className="mr-2" /> Save changes</>}
          </Button>
        </div>

        <motion.div key={active} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}
          className="bg-white border border-slate-200 p-7 space-y-6">
          {active === "company" && (
            <>
              <Field label="Startup name"><Input value={form.startup_name} onChange={(e) => update("startup_name", e.target.value)} className="h-11 rounded-md" data-testid="input-startup-name" /></Field>
              <Field label="Overview"><Textarea value={form.startup_overview} onChange={(e) => update("startup_overview", e.target.value)} rows={3} className="rounded-md" data-testid="input-overview" /></Field>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <Field label="Stage">
                  <Select value={form.stage} onValueChange={(v) => update("stage", v)}>
                    <SelectTrigger className="h-11 rounded-md" data-testid="select-stage"><SelectValue placeholder="Select…" /></SelectTrigger>
                    <SelectContent>{["Idea", "MVP", "Early Revenue", "Growth", "PMF", "Scale"].map((x) => <SelectItem key={x} value={x}>{x}</SelectItem>)}</SelectContent>
                  </Select>
                </Field>
                <Field label="Sector">
                  <Select value={form.sector} onValueChange={(v) => update("sector", v)}>
                    <SelectTrigger className="h-11 rounded-md" data-testid="select-sector"><SelectValue placeholder="Select…" /></SelectTrigger>
                    <SelectContent>{["AgriTech", "AI / ML", "DeepTech", "FinTech", "HealthTech", "Climate / Energy", "Smart Cities"].map((x) => <SelectItem key={x} value={x}>{x}</SelectItem>)}</SelectContent>
                  </Select>
                </Field>
                <Field label="Founded"><Input value={form.founded} onChange={(e) => update("founded", e.target.value)} className="h-11 rounded-md" /></Field>
                <Field label="Incorporation"><Input value={form.incorporation} onChange={(e) => update("incorporation", e.target.value)} className="h-11 rounded-md" /></Field>
                <Field label="DPIIT"><Input value={form.dpiit} onChange={(e) => update("dpiit", e.target.value)} className="h-11 rounded-md" /></Field>
                <Field label="Headquarters"><Input value={form.location} onChange={(e) => update("location", e.target.value)} className="h-11 rounded-md" /></Field>
              </div>
            </>
          )}

          {active === "story" && (
            <>
              <Field label="Problem statement"><Textarea rows={4} value={form.problem_statement} onChange={(e) => update("problem_statement", e.target.value)} className="rounded-md" /></Field>
              <Field label="Solution summary"><Textarea rows={4} value={form.solution_summary} onChange={(e) => update("solution_summary", e.target.value)} className="rounded-md" /></Field>
              <Field label="Target customers"><Textarea rows={3} value={form.target_customers} onChange={(e) => update("target_customers", e.target.value)} className="rounded-md" /></Field>
              <Field label="Business model"><Textarea rows={3} value={form.business_model} onChange={(e) => update("business_model", e.target.value)} className="rounded-md" /></Field>
            </>
          )}

          {active === "traction" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <Field label="Team size"><Input value={form.team_size} onChange={(e) => update("team_size", e.target.value)} className="h-11 rounded-md" /></Field>
              <Field label="Revenue"><Input value={form.revenue} onChange={(e) => update("revenue", e.target.value)} className="h-11 rounded-md" /></Field>
              <div className="md:col-span-2">
                <Field label="Traction summary"><Textarea rows={4} value={form.traction_summary} onChange={(e) => update("traction_summary", e.target.value)} className="rounded-md" /></Field>
              </div>
            </div>
          )}

          {active === "presence" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <Field label="Website"><Input value={form.website} onChange={(e) => update("website", e.target.value)} className="h-11 rounded-md" /></Field>
            </div>
          )}
        </motion.div>
      </section>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <Label className="text-xs uppercase tracking-wider text-slate-500 font-bold mb-2 block">{label}</Label>
      {children}
    </div>
  );
}

