import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, Eye, EyeOff, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import AuthShell from "./AuthShell";
import { apiLogin, errMsg } from "@/lib/api";
import { setAuth } from "@/lib/auth";

export default function Login() {
  const nav = useNavigate();
  const location = useLocation();
  const intended = location.state?.from || "/dashboard";
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [form, setForm] = useState({ email: "", password: "" });

  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    setBusy(true);
    try {
      const { user } = await apiLogin(form);
      setAuth(user);
      toast.success(`Welcome back, ${user.name.split(" ")[0]}`);
      nav(intended, { replace: true });
    } catch (e) {
      const msg = errMsg(e, "Could not sign in. Check credentials.");
      setErr(msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell
      narrow
      eyebrow="Welcome back"
      title={<>Pick up where you <span className="font-serif-display text-sky-600">left off</span>.</>}
      sub="Your pipeline is waiting."
      footer={<>New to FundMe? <Link to="/signup" className="text-sky-600 font-semibold hover:underline" data-testid="signup-redirect">Get started →</Link></>}
    >
      <motion.form
        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
        onSubmit={submit} className="bg-white border border-slate-200 p-7 space-y-5" data-testid="login-page"
      >
        <div>
          <Label className="text-xs uppercase tracking-wider text-slate-500 font-bold">Email</Label>
          <Input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
            placeholder="you@startup.com" className="mt-2 h-12 rounded-md" data-testid="login-email" />
        </div>
        <div>
          <Label className="text-xs uppercase tracking-wider text-slate-500 font-bold">Password</Label>
          <div className="relative mt-2">
            <Input type={show ? "text" : "password"} required value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              placeholder="••••••••" className="h-12 rounded-md pr-10" data-testid="login-password" />
            <button type="button" onClick={() => setShow(!show)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
              data-testid="toggle-password-visibility">
              {show ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>

        {err && <div className="text-sm text-rose-700 bg-rose-50 border border-rose-200 px-3 py-2 rounded-md" data-testid="login-error">{err}</div>}

        <Button type="submit" disabled={busy}
          className="w-full h-12 rounded-md bg-slate-900 hover:bg-slate-800 text-white font-medium btn-press disabled:opacity-60"
          data-testid="login-submit">
          {busy ? <><Loader2 size={14} className="mr-2 animate-spin" /> Signing in…</> : <>Sign in <ArrowRight size={14} className="ml-2" /></>}
        </Button>

        <div className="text-center pt-1">
          <Link to="/forgot-password" className="text-sm text-slate-500 hover:text-sky-600" data-testid="forgot-link">
            Forgot your password?
          </Link>
        </div>
      </motion.form>
    </AuthShell>
  );
}
