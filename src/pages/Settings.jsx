import { useState } from "react";
import { motion } from "framer-motion";
import { User, Bell, Shield, CreditCard, Trash2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const TABS = [
  { id: "account", label: "Account", Icon: User },
  { id: "notifications", label: "Notifications", Icon: Bell },
  { id: "privacy", label: "Privacy & Security", Icon: Shield },
  { id: "billing", label: "Billing", Icon: CreditCard },
];

export default function Settings() {
  const [tab, setTab] = useState("account");
  const [notify, setNotify] = useState({ deadline: true, matches: true, weekly: false, marketing: false });

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
                tab === id ? "bg-[var(--primary)] text-white" : "text-slate-700 hover:bg-[var(--primary-light)]"
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
              <Field label="Full name"><Input defaultValue="Avni Gaur" className="h-11 rounded-md" data-testid="input-fullname" /></Field>
              <Field label="Email"><Input type="email" defaultValue="avni@agrisense.ai" className="h-11 rounded-md" data-testid="input-email" /></Field>
              <Field label="Phone"><Input defaultValue="+91 98xxxx1234" className="h-11 rounded-md" /></Field>
              <Field label="Designation"><Input defaultValue="Founder & CEO" className="h-11 rounded-md" /></Field>
              <div className="md:col-span-2 flex justify-end">
                <Button onClick={() => toast.success("Account updated")} className="rounded-md bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white h-11 px-5 btn-press" data-testid="save-account">
                  Save changes
                </Button>
              </div>
            </div>
          )}

          {tab === "notifications" && (
            <div className="space-y-5">
              <ToggleRow label="Deadline reminders" desc="Get notified 7, 3 and 1 day before any deadline." checked={notify.deadline} onChange={(v) => setNotify({ ...notify, deadline: v })} testid="notif-deadline" />
              <ToggleRow label="New high-relevance matches" desc="Email me when an opportunity matches 80%+." checked={notify.matches} onChange={(v) => setNotify({ ...notify, matches: v })} testid="notif-matches" />
              <ToggleRow label="Weekly digest" desc="A Monday morning recap of your pipeline." checked={notify.weekly} onChange={(v) => setNotify({ ...notify, weekly: v })} testid="notif-weekly" />
              <ToggleRow label="Product updates" desc="Occasional emails about new features." checked={notify.marketing} onChange={(v) => setNotify({ ...notify, marketing: v })} testid="notif-marketing" />
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
              <div className="bg-[var(--primary-light)] border border-[var(--primary-light)] p-6">
                <div className="text-xs uppercase tracking-wider text-[var(--accent)] font-bold">Current plan</div>
                <div className="mt-2 font-display text-3xl font-bold">Founder · Free</div>
                <p className="mt-2 text-sm text-[var(--accent)]/80">Unlock unlimited AI drafts, Kanban automations, and priority support.</p>
                <Button className="mt-4 rounded-md bg-[var(--accent)] hover:bg-[var(--accent)]/90 text-white" data-testid="upgrade-plan">
                  Upgrade to Growth
                </Button>
              </div>
              <Field label="Billing email"><Input defaultValue="finance@agrisense.ai" className="h-11 rounded-md" /></Field>
              <Field label="GSTIN"><Input defaultValue="29ABCDE1234F1Z5" className="h-11 rounded-md" /></Field>
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

