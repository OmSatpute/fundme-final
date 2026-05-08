import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { User, Bell, Shield, CreditCard, Trash2, Loader2, Save, Check, ArrowUpRight, Sparkles } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";
import { apiGetUser, apiUpdateUser, errMsg } from "@/lib/api";
import { setAuth } from "@/lib/auth";

const TABS = [
  { id: "account", label: "Account", Icon: User },
  { id: "notifications", label: "Notifications", Icon: Bell },
  { id: "privacy", label: "Privacy & Security", Icon: Shield },
  { id: "billing", label: "Billing", Icon: CreditCard },
];

const PRICING_TIERS = [
  {
    name: "Free",
    subtitle: "Validate FundMe with one founder profile",
    price: "Rs 0",
    cadence: "/ month",
    cta: "Current plan",
    muted: true,
    features: [
      "5 AI refreshes per month",
      "5 AI draft generations",
      "25 opportunity scrapes",
      "AI profile generation from summary or deck",
      "Basic Smart Apply extension fill",
      "Save up to 10 opportunities",
    ],
  },
  {
    name: "Plus",
    subtitle: "For founders actively applying every month",
    price: "Rs 999",
    cadence: "/ month",
    cta: "Get Plus",
    badge: "Best for founders",
    featured: true,
    features: [
      "25 AI draft generations",
      "150 opportunity scrapes",
      "AI fit scores and eligibility reasoning",
      "AI insights for deadlines and follow-ups",
      "Smart Apply field mapping and portal fill",
      "Unlimited saved opportunities and applications",
    ],
  },
  {
    name: "Pro",
    subtitle: "For teams running funding as a pipeline",
    price: "Rs 2,999",
    cadence: "/ month",
    cta: "Get Pro",
    features: [
      "100 AI draft generations",
      "1,000 opportunity scrapes",
      "Advanced tender and business-opportunity monitoring",
      "Team pipeline, owners, notes, and follow-up workflows",
      "Priority Smart Apply and deeper AI insights",
      "Priority support and custom opportunity sources",
    ],
  },
];

export default function Settings() {
  const [tab, setTab] = useState("account");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [pricingOpen, setPricingOpen] = useState(false);
  const [user, setUser] = useState({
    name: "",
    email: "",
    phone: "",
    designation: "",
    notifications: { deadline: true, matches: true, weekly: false, marketing: false },
    billing_email: "",
    gstin: ""
  });

  useEffect(() => {
    apiGetUser()
      .then((data) => {
        setUser((prev) => ({
          ...prev,
          ...data,
          notifications: data.notifications || prev.notifications
        }));
      })
      .catch((e) => toast.error(errMsg(e, "Failed to load settings")))
      .finally(() => setLoading(false));
  }, []);

  const update = (k, v) => setUser(prev => ({ ...prev, [k]: v }));
  const updateNotif = (k, v) => setUser(prev => ({
    ...prev,
    notifications: { ...prev.notifications, [k]: v }
  }));

  const save = async () => {
    setBusy(true);
    try {
      const updated = await apiUpdateUser(user);
      setAuth(updated);
      toast.success("Settings saved successfully");
    } catch (e) {
      toast.error(errMsg(e, "Save failed"));
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh]">
        <Loader2 className="animate-spin text-[var(--accent)] mb-4" size={32} />
        <p className="text-slate-500 font-medium">Loading your preferences...</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-12 gap-10 max-w-6xl" data-testid="settings-page">
      <aside className="col-span-12 lg:col-span-3 lg:sticky lg:top-24 lg:self-start">
        <div className="text-[10px] uppercase tracking-[0.22em] text-[var(--accent)] font-bold mb-4">Settings</div>
        <div className="space-y-1">
          {TABS.map(({ id, label, Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              data-testid={`settings-tab-${id}`}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-all ${
                tab === id ? "bg-[var(--primary-light)] text-slate-950 font-semibold" : "text-slate-700 hover:bg-[var(--primary-light)]"
              }`}
            >
              <Icon size={15} strokeWidth={1.75} />
              {label}
            </button>
          ))}
        </div>
      </aside>

      <section className="col-span-12 lg:col-span-9">
        <h1 className="font-display text-4xl md:text-5xl font-bold tracking-tight mb-2 capitalize">{tab}</h1>
        <p className="text-slate-500 mb-8">Manage your {tab} preferences below.</p>

        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="bg-white border border-slate-200 p-7 space-y-6"
        >
          {tab === "account" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <Field label="Full name">
                <Input value={user.name} onChange={e => update("name", e.target.value)} className="h-11 rounded-md" data-testid="input-fullname" />
              </Field>
              <Field label="Email">
                <Input type="email" value={user.email} onChange={e => update("email", e.target.value)} className="h-11 rounded-md" data-testid="input-email" />
              </Field>
              <Field label="Phone">
                <Input value={user.phone || ""} onChange={e => update("phone", e.target.value)} placeholder="+91 98xxxx1234" className="h-11 rounded-md" />
              </Field>
              <Field label="Designation">
                <Input value={user.designation || ""} onChange={e => update("designation", e.target.value)} placeholder="Founder & CEO" className="h-11 rounded-md" />
              </Field>
              <div className="md:col-span-2 flex justify-end">
                <Button onClick={save} disabled={busy} className="rounded-md bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white h-11 px-6 btn-press" data-testid="save-account">
                  {busy ? <Loader2 size={16} className="mr-2 animate-spin" /> : <Save size={16} className="mr-2" />}
                  Save changes
                </Button>
              </div>
            </div>
          )}

          {tab === "notifications" && (
            <div className="space-y-5">
              <ToggleRow label="Deadline reminders" desc="Get notified 7, 3 and 1 day before any deadline." checked={user.notifications.deadline} onChange={(v) => updateNotif("deadline", v)} testid="notif-deadline" />
              <ToggleRow label="New high-relevance matches" desc="Email me when an opportunity matches 80%+." checked={user.notifications.matches} onChange={(v) => updateNotif("matches", v)} testid="notif-matches" />
              <ToggleRow label="Weekly digest" desc="A Monday morning recap of your pipeline." checked={user.notifications.weekly} onChange={(v) => updateNotif("weekly", v)} testid="notif-weekly" />
              <ToggleRow label="Product updates" desc="Occasional emails about new features." checked={user.notifications.marketing} onChange={(v) => updateNotif("marketing", v)} testid="notif-marketing" />
              <div className="flex justify-end pt-4">
                <Button onClick={save} disabled={busy} className="rounded-md bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white h-11 px-6 btn-press">
                  {busy ? <Loader2 size={16} className="mr-2 animate-spin" /> : <Save size={16} className="mr-2" />}
                  Save preferences
                </Button>
              </div>
            </div>
          )}

          {tab === "privacy" && (
            <div className="space-y-6">
              <Field label="Change password">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <Input type="password" placeholder="Current password" className="h-11 rounded-md" />
                  <Input type="password" placeholder="New password" className="h-11 rounded-md" />
                </div>
              </Field>
              <ToggleRow label="Two-factor authentication" desc="Protect your account with an authenticator app." checked={true} onChange={() => {}} testid="toggle-2fa" />
              <div className="border-t border-slate-200 pt-6">
                <div className="text-xs uppercase tracking-wider text-rose-600 font-bold mb-2">Danger zone</div>
                <Button variant="outline" className="rounded-md border-rose-300 text-rose-700 hover:bg-rose-50" data-testid="delete-account">
                  <Trash2 size={14} className="mr-2" /> Delete account
                </Button>
              </div>
            </div>
          )}

          {tab === "billing" && (
            <div className="space-y-6">
              <div className="bg-[var(--primary-light)] border border-[var(--primary-light)] p-6 rounded-md">
                <div className="text-xs uppercase tracking-wider text-[var(--accent)] font-bold">Current plan</div>
                <div className="mt-2 font-display text-3xl font-bold text-slate-900">Free - 5 AI refreshes</div>
                <p className="mt-2 text-sm text-slate-600">
                  Try FundMe with 5 AI refreshes for matching, profile updates, and draft generation. Upgrade when your team needs unlimited Smart Apply workflows.
                </p>
                <div className="mt-5 rounded-md border border-emerald-200 bg-white p-4">
                  <div className="flex items-center justify-between gap-4 text-sm">
                    <span className="font-semibold text-slate-900">AI refreshes available</span>
                    <span className="text-[var(--accent)] font-bold">5 / 5</span>
                  </div>
                  <div className="mt-3 h-2 rounded-full bg-emerald-100 overflow-hidden">
                    <div className="h-full w-full bg-[var(--accent)]" />
                  </div>
                  <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs text-slate-600">
                    <div className="rounded-md bg-slate-50 px-3 py-2">AI match refresh</div>
                    <div className="rounded-md bg-slate-50 px-3 py-2">AI draft generation</div>
                    <div className="rounded-md bg-slate-50 px-3 py-2">Smart Apply fill</div>
                  </div>
                </div>
                <Button onClick={() => setPricingOpen(true)} className="mt-4 rounded-md bg-[var(--accent)] hover:bg-[var(--accent)]/90 text-white" data-testid="upgrade-plan">
                  View plans
                </Button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <Field label="Billing email">
                  <Input value={user.billing_email || ""} onChange={e => update("billing_email", e.target.value)} placeholder="finance@agrisense.ai" className="h-11 rounded-md" />
                </Field>
                <Field label="GSTIN">
                  <Input value={user.gstin || ""} onChange={e => update("gstin", e.target.value)} placeholder="29ABCDE1234F1Z5" className="h-11 rounded-md" />
                </Field>
              </div>
              <div className="flex justify-end">
                <Button onClick={save} disabled={busy} className="rounded-md bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white h-11 px-6 btn-press">
                  {busy ? <Loader2 size={16} className="mr-2 animate-spin" /> : <Save size={16} className="mr-2" />}
                  Save billing info
                </Button>
              </div>
            </div>
          )}
        </motion.div>
      </section>
      <PricingModal open={pricingOpen} onOpenChange={setPricingOpen} />
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

function ToggleRow({ label, desc, checked, onChange, testid }) {
  return (
    <div className="flex items-start justify-between gap-4 py-3 border-b border-slate-100 last:border-0">
      <div className="flex-1">
        <div className="font-medium text-slate-900">{label}</div>
        <div className="text-sm text-slate-500 mt-0.5">{desc}</div>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} data-testid={testid} className="data-[state=checked]:bg-[var(--accent)]" />
    </div>
  );
}

function PricingModal({ open, onOpenChange }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl border-slate-200 bg-white p-0 text-slate-900 shadow-2xl sm:rounded-2xl overflow-hidden">
        <div className="px-6 py-5 sm:px-8 sm:py-6 border-b border-slate-100 bg-slate-50/50">
          <DialogHeader>
            <div className="inline-flex w-fit items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald-700">
              <Sparkles size={12} /> FundMe plans
            </div>
            <DialogTitle className="mt-3 font-display text-2xl md:text-3xl text-slate-900 tracking-tight">
              Choose how much funding work AI should handle.
            </DialogTitle>
          </DialogHeader>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-0 divide-y md:divide-y-0 md:divide-x divide-slate-100">
          {PRICING_TIERS.map((tier) => (
            <PricingCard key={tier.name} tier={tier} />
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function PricingCard({ tier }) {
  const isPlus = tier.name === "Plus";
  return (
    <div className={`relative flex flex-col p-6 sm:p-8 ${isPlus ? "bg-emerald-50/30" : "bg-white"}`}>
      {tier.badge && (
        <div className="absolute right-6 top-4 rounded-md bg-emerald-700 px-2 py-1 text-[9px] font-bold uppercase tracking-widest text-white shadow-sm">
          {tier.badge}
        </div>
      )}
      <div className="mb-6">
        <h3 className={`font-display text-xl font-bold ${isPlus ? "text-emerald-900" : "text-slate-900"}`}>{tier.name}</h3>
        <p className="mt-1 text-sm text-slate-500 leading-tight">{tier.subtitle}</p>
      </div>

      <div className="mb-8">
        <div className="flex items-baseline gap-1">
          <span className={`text-3xl font-bold ${isPlus ? "text-emerald-950" : "text-slate-900"}`}>{tier.price}</span>
          <span className="text-sm font-medium text-slate-400">{tier.cadence}</span>
        </div>

        <Button
          variant={isPlus ? "default" : "outline"}
          className={`mt-6 w-full font-bold h-10 ${
            isPlus
              ? "bg-emerald-700 text-white hover:bg-emerald-800 shadow-lg shadow-emerald-700/20"
              : "border-slate-200 text-slate-600 hover:bg-slate-50"
          }`}
          disabled={tier.name === "Free"}
        >
          {tier.cta}
          {!tier.muted && <ArrowUpRight size={14} className="ml-2" />}
        </Button>
      </div>

      <div className="space-y-3 flex-1">
        <div className={`text-[10px] font-bold uppercase tracking-widest ${isPlus ? "text-emerald-700" : "text-slate-400"} mb-4`}>
          {tier.name === "Free" ? "Includes:" : tier.name === "Plus" ? "Everything in Free, plus:" : "Everything in Plus, plus:"}
        </div>
        <ul className="space-y-3">
          {tier.features.map((feature) => (
            <li key={feature} className="flex items-center gap-3">
              <Check size={14} className={`shrink-0 ${isPlus ? "text-emerald-600" : "text-slate-400"}`} strokeWidth={3} />
              <span className="text-sm text-slate-600 font-medium leading-tight">{feature}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

