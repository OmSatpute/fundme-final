import { useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, Mail, CheckCircle2, ArrowLeft } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import AuthShell from "./AuthShell";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);

  return (
    <AuthShell
      narrow
      eyebrow="Reset password"
      title={<>Reset and <span className="font-serif-display text-sky-600">resume</span>.</>}
      sub="Enter your email and we'll send a link to set a new password."
    >
      <Link to="/login" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900 mb-6">
        <ArrowLeft size={13} /> Back to sign in
      </Link>

      {sent ? (
        <motion.div
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          className="bg-sky-50 border border-sky-200 p-6 flex gap-3 rounded-md"
          data-testid="forgot-sent"
        >
          <CheckCircle2 size={22} className="text-sky-600 mt-0.5 shrink-0" />
          <div>
            <div className="font-display text-lg font-semibold text-sky-900">Check your inbox</div>
            <div className="mt-1 text-sm text-sky-900/80">We sent a reset link to <span className="font-medium">{email}</span>.</div>
            <div className="mt-3 text-xs text-sky-900/70">Didn't get it? Check spam, or <button onClick={() => setSent(false)} className="underline">try another email</button>.</div>
          </div>
        </motion.div>
      ) : (
        <motion.form
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
          onSubmit={(e) => { e.preventDefault(); setSent(true); }}
          className="bg-white border border-slate-200 p-7 space-y-5"
          data-testid="forgot-page"
        >
          <div>
            <Label className="text-xs uppercase tracking-wider text-slate-500 font-bold">Email</Label>
            <div className="relative mt-2">
              <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="you@startup.com" className="h-12 rounded-md pl-10" data-testid="forgot-email" />
            </div>
          </div>
          <Button type="submit" className="w-full h-12 rounded-md bg-slate-900 hover:bg-slate-800 text-white font-medium btn-press" data-testid="forgot-submit">
            Send reset link <ArrowRight size={14} className="ml-2" />
          </Button>
        </motion.form>
      )}
    </AuthShell>
  );
}
