import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, Eye, EyeOff, CheckCircle2, Check, X, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import AuthShell from "./AuthShell";
import { apiSignup, errMsg } from "@/lib/api";
import { setAuth, passwordRules, validatePassword } from "@/lib/auth";
import { toast } from "sonner";

export default function Signup() {
  const nav = useNavigate();
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [form, setForm] = useState({ name: "", email: "", password: "" });

  const passOk = validatePassword(form.password);

  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    if (!passOk) {
      setErr("Password doesn't meet the requirements below.");
      return;
    }
    setBusy(true);
    try {
      const { user } = await apiSignup({ ...form, role: "founder" });
      setAuth(user);
      toast.success(`Welcome, ${user.name.split(" ")[0]}`);
      nav("/onboarding/profile", { replace: true });
    } catch (e) {
      setErr(errMsg(e, "Could not create account."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell
      narrow
      eyebrow="Create your account"
      title={<>Personalised funding starts with your <span className="font-serif-display text-emerald-700">profile</span>.</>}
      sub="Built for founders. Free to start."
      footer={<>Already have an account? <Link to="/login" className="text-emerald-700 font-semibold hover:underline">Sign in</Link></>}
    >
      <motion.form
        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
        onSubmit={submit} className="bg-white border border-slate-200 p-7 space-y-5" data-testid="signup-page"
      >
        <div className="px-3 py-2.5 bg-emerald-50 border border-emerald-200 rounded-md flex items-center gap-2 text-sm text-emerald-900">
          <CheckCircle2 size={15} className="text-emerald-700" /> Signing up as a <span className="font-semibold">Founder</span>
        </div>

        <div>
          <Label className="text-xs uppercase tracking-wider text-slate-500 font-bold">Full Name</Label>
          <Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Jane Doe" className="mt-2 h-12 rounded-md" data-testid="signup-name" />
        </div>
        <div>
          <Label className="text-xs uppercase tracking-wider text-slate-500 font-bold">Primary Account Email</Label>
          <Input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
            placeholder="jane@startup.com" className="mt-2 h-12 rounded-md" data-testid="signup-email" />
        </div>
        <div>
          <Label className="text-xs uppercase tracking-wider text-slate-500 font-bold">Password</Label>
          <div className="relative mt-2">
            <Input type={show ? "text" : "password"} required value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              placeholder="At least 8 characters" className="h-12 rounded-md pr-10" data-testid="signup-password" />
            <button type="button" onClick={() => setShow(!show)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700">
              {show ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          {form.password && (
            <ul className="mt-3 space-y-1.5" data-testid="password-rules">
              {passwordRules.map((r) => {
                const ok = r.test(form.password);
                return (
                  <li key={r.label} className={`text-xs flex items-center gap-2 ${ok ? "text-emerald-700" : "text-slate-500"}`}>
                    {ok ? <Check size={12} /> : <X size={12} />}
                    {r.label}
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {err && <div className="text-sm text-rose-700 bg-rose-50 border border-rose-200 px-3 py-2 rounded-md" data-testid="signup-error">{err}</div>}

        <Button type="submit" disabled={busy || !passOk}
          className="w-full h-12 rounded-md bg-slate-900 hover:bg-slate-800 text-white font-medium btn-press disabled:opacity-60 disabled:cursor-not-allowed"
          data-testid="signup-submit">
          {busy ? <><Loader2 size={14} className="mr-2 animate-spin" /> Creating account…</> : <>Continue <ArrowRight size={14} className="ml-2" /></>}
        </Button>

        <p className="text-xs text-slate-500 text-center pt-1">
          Your data is securely stored. Refine your profile any time.
        </p>
      </motion.form>
    </AuthShell>
  );
}
