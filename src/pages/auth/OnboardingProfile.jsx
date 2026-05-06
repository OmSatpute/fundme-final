import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Upload, ArrowRight, ArrowLeft, Loader2, Globe, FileText as FileIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import AuthShell from "./AuthShell";
import { apiGenerateProfile, errMsg } from "@/lib/api";
import { toast } from "sonner";

export default function OnboardingProfile() {
  const nav = useNavigate();
  const [url, setUrl] = useState("");
  const [summary, setSummary] = useState("");
  const [pdf, setPdf] = useState(null);
  const [loading, setLoading] = useState(false);

  const generate = async () => {
    if (!url && !summary && !pdf) return;
    setLoading(true);
    try {
      const { result } = await apiGenerateProfile({ file: pdf, startup_overview: summary, website: url });
      sessionStorage.setItem("fm_ai_profile", JSON.stringify(result));
      nav("/onboarding/review");
    } catch (e) {
      toast.error(errMsg(e, "AI extraction failed. Try a different input or add API keys."));
      setLoading(false);
    }
  };

  return (
    <AuthShell
      eyebrow="Step 1 of 2 · Build profile"
      title={<>Let AI turn your materials into <span className="font-serif-display text-emerald-600">momentum</span>.</>}
      sub="Pick one input — paste a URL, write a summary, or upload your deck. We'll extract sector, stage, problem, and solution for your review."
    >
      <AnimatePresence>
        {loading && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-[#FAF9F6]/95 backdrop-blur-sm flex flex-col items-center justify-center z-50"
            data-testid="ai-loading"
          >
            <div className="relative">
              <Loader2 size={42} className="animate-spin text-emerald-600" />
              <div className="absolute inset-0 rounded-full bg-emerald-400/30 blur-xl animate-pulse" />
            </div>
            <div className="mt-7 font-display text-2xl font-semibold tracking-tight">Analyzing materials…</div>
            <div className="mt-1 text-sm text-slate-500">Connecting to AI analysis engine</div>
            <div className="mt-6 text-xs text-slate-400 font-mono">extracting · sector · stage · problem · solution</div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div
        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
        className="space-y-4" data-testid="onboarding-profile-page"
      >
        <div className="bg-white border border-slate-200 p-6">
          <div className="flex items-center gap-2 mb-3">
            <Globe size={14} className="text-emerald-600" />
            <span className="text-xs uppercase tracking-wider text-slate-500 font-bold">Option A · Website URL</span>
          </div>
          <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://yourstartup.com"
            className="h-12 rounded-md" data-testid="onboarding-url" />
          <p className="mt-2 text-xs text-slate-500">Best when your product or company site clearly explains what you do.</p>
        </div>

        <div className="flex items-center gap-3 px-2">
          <div className="flex-1 h-px bg-slate-200" /><span className="text-xs text-slate-400 font-medium tracking-wider">OR</span><div className="flex-1 h-px bg-slate-200" />
        </div>

        <div className="bg-white border border-slate-200 p-6">
          <div className="flex items-center gap-2 mb-3">
            <FileIcon size={14} className="text-emerald-600" />
            <span className="text-xs uppercase tracking-wider text-slate-500 font-bold">Option B · Summary</span>
          </div>
          <Textarea rows={5} value={summary} onChange={(e) => setSummary(e.target.value)}
            placeholder="Tell us about what you're building — elevator pitch, key problem, who you serve…"
            className="rounded-md" data-testid="onboarding-summary" />
          <p className="mt-2 text-xs text-slate-500">2–4 sentences is enough.</p>
        </div>

        <div className="flex items-center gap-3 px-2">
          <div className="flex-1 h-px bg-slate-200" /><span className="text-xs text-slate-400 font-medium tracking-wider">OR</span><div className="flex-1 h-px bg-slate-200" />
        </div>

        <div className="bg-white border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Upload size={14} className="text-emerald-600" />
              <span className="text-xs uppercase tracking-wider text-slate-500 font-bold">Option C · Pitch Deck</span>
            </div>
            <span className="text-[10px] uppercase tracking-wider text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">Richest extraction</span>
          </div>
          <label className="block border-2 border-dashed border-slate-300 hover:border-emerald-400 hover:bg-emerald-50/30 rounded-md p-8 text-center cursor-pointer transition-colors" data-testid="onboarding-pdf-zone">
            <input type="file" accept=".pdf" hidden onChange={(e) => setPdf(e.target.files?.[0] || null)} />
            <Upload size={22} className={`mx-auto ${pdf ? "text-emerald-600" : "text-slate-400"}`} />
            <div className={`mt-2 text-sm font-semibold ${pdf ? "text-emerald-800" : "text-slate-700"}`}>{pdf ? pdf.name : "Click or drag to upload PDF"}</div>
            <div className="text-xs text-slate-500 mt-1">Add a pitch deck or supporting document.</div>
          </label>
        </div>

        <div className="mt-6 p-5 bg-emerald-700 text-white">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles size={14} className="text-emerald-400" />
            <span className="text-xs uppercase tracking-[0.18em] text-emerald-400 font-bold">What AI will generate</span>
          </div>
          <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm text-white/85">
            <div>· Startup name & sector</div><div>· Target users & problem</div>
            <div>· Stage & traction</div><div>· Funding ask & use</div>
          </div>
        </div>

        <div className="flex gap-3 pt-4">
          <Button variant="outline" onClick={() => nav("/signup")} className="h-12 rounded-md border-slate-300" data-testid="onboarding-back">
            <ArrowLeft size={14} className="mr-2" /> Back
          </Button>
          <Button onClick={generate} disabled={!url && !summary && !pdf}
            className="flex-1 h-12 rounded-md bg-emerald-700 hover:bg-emerald-800 text-white font-medium btn-press disabled:opacity-50 disabled:cursor-not-allowed"
            data-testid="onboarding-generate">
            <Sparkles size={14} className="mr-2" /> Generate profile <ArrowRight size={14} className="ml-2" />
          </Button>
        </div>

        <p className="text-xs text-slate-500 text-center pt-2">
          Your data is securely stored. You can refine this any time.
        </p>
      </motion.div>
    </AuthShell>
  );
}
