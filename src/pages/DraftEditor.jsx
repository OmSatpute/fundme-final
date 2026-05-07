import { useEffect, useMemo, useState } from "react";
import { Link, useParams, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, CheckCircle2, ExternalLink, Eye, FileEdit, FileText, Loader2, Save, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ExtensionInstallModal } from "@/components/ExtensionInstallModal";
import {
  apiGenerateDraftAnswers,
  apiGetDraft,
  apiGetProfile,
  apiUpdateDraft,
  errMsg,
} from "@/lib/api";
import { getApplyLink, stageExtensionContext } from "@/lib/applyFlow";
import { checkExtensionInstalled } from "@/lib/utils";

const fieldsFromSchema = (schema = {}) =>
  (schema.sections || []).flatMap((section) =>
    (section.fields || []).map((field) => ({
      ...field,
      section: field.section || section.title || "Application Details",
    }))
  );

export default function DraftEditor() {
  const { id } = useParams();
  const { search } = useLocation();
  const isReview = new URLSearchParams(search).get("review") === "true";
  const [draft, setDraft] = useState(null);
  const [values, setValues] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [applyBusy, setApplyBusy] = useState(false);
  const [showExtensionModal, setShowExtensionModal] = useState(false);

  useEffect(() => {
    setLoading(true);
    apiGetDraft(id)
      .then((data) => {
        setDraft(data);
        setValues(data.form_fields || {});

        if (sessionStorage.getItem("FUNDME_EXT_RELOAD") === window.location.pathname) {
          sessionStorage.removeItem("FUNDME_EXT_RELOAD");
          sessionStorage.removeItem("FUNDME_EXT_PENDING_DRAFT");
          setTimeout(() => {
            const btn = document.querySelector('[data-testid="draft-editor-apply-portal"]');
            if (btn) btn.click();
          }, 800);
        }
      })
      .catch((e) => toast.error(errMsg(e, "Could not load draft.")))
      .finally(() => setLoading(false));
  }, [id]);

  const fields = useMemo(() => fieldsFromSchema(draft?.form_schema), [draft]);
  const sections = useMemo(() => {
    return fields.reduce((acc, field) => {
      const key = field.section || "Application Details";
      acc[key] = acc[key] || [];
      acc[key].push(field);
      return acc;
    }, {});
  }, [fields]);
  const applyLink = useMemo(() => getApplyLink(draft || {}), [draft]);

  const setField = (fieldId, value) => {
    setValues((current) => ({ ...current, [fieldId]: value }));
  };

  const saveDraft = async (nextValues = values) => {
    setSaving(true);
    try {
      const updated = await apiUpdateDraft(id, { form_fields: nextValues });
      setDraft((current) => ({ ...current, ...updated }));
      toast.success("Draft saved");
    } catch (e) {
      toast.error(errMsg(e, "Could not save draft."));
    } finally {
      setSaving(false);
    }
  };

  const generateAnswers = async () => {
    setGenerating(true);
    try {
      const profile = await apiGetProfile();
      const generated = await apiGenerateDraftAnswers({
        profile: profile || {},
        form_fields: values,
        form_schema: draft.form_schema,
        opportunity: draft.opportunity || { opportunity_id: draft.opportunity_id, title: draft.opportunity_title },
      });
      const nextValues = { ...values, ...(generated.result || {}) };
      setValues(nextValues);
      await saveDraft(nextValues);
      toast.success("AI draft updated");
    } catch (e) {
      toast.error(errMsg(e, "Could not generate draft answers."));
    } finally {
      setGenerating(false);
    }
  };

  const applyToPortal = async ({ skipInstallCheck = false } = {}) => {
    if (!applyLink) {
      toast.error("No portal link is available for this draft.");
      return;
    }

    setApplyBusy(true);
    try {
      if (!isReview) {
        const updated = await apiUpdateDraft(id, { form_fields: values });
        setDraft((current) => ({ ...current, ...updated }));
      }

      if (!skipInstallCheck) {
        const isInstalled = await checkExtensionInstalled();
        if (!isInstalled) {
          sessionStorage.setItem("FUNDME_EXT_PENDING_DRAFT", id);
          setShowExtensionModal(true);
          return;
        }
      }

      await stageExtensionContext({ opportunity_id: draft.opportunity_id, external_url: applyLink });
      window.open(applyLink, "_blank", "noopener,noreferrer");
      toast.success("Portal opened. The extension will fill from this draft when the form appears.");
    } catch (e) {
      toast.error(errMsg(e, "Could not prepare the extension context."));
    } finally {
      setApplyBusy(false);
    }
  };

  const applyWithoutExtension = () => {
    if (!applyLink) return;
    window.open(applyLink, "_blank", "noopener,noreferrer");
    toast.info("Opening portal without extension.");
  };

  if (loading) {
    return <div className="flex justify-center py-32"><Loader2 className="animate-spin text-emerald-600" /></div>;
  }

  if (!draft) {
    return (
      <div className="max-w-4xl border border-dashed border-slate-300 bg-white p-12 text-center" data-testid="draft-editor-error">
        <FileText size={28} className="mx-auto text-slate-400" />
        <div className="mt-4 font-semibold">Draft not found</div>
        <Link to="/drafts" className="mt-4 inline-flex text-sm font-medium text-emerald-600">Back to drafts</Link>
      </div>
    );
  }

  return (
    <div className="max-w-5xl space-y-8" data-testid="draft-editor-page">
      <header className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
        <div>
          <Link to="/drafts" className="inline-flex items-center text-sm font-medium text-slate-500 hover:text-slate-900">
            <ArrowLeft size={14} className="mr-2" /> Back to drafts
          </Link>
          <div className="mt-5 text-[10px] uppercase tracking-[0.22em] text-emerald-600 font-bold">{isReview ? "Reviewing draft" : "Application draft"}</div>
          <h1 className="mt-2 font-display text-4xl md:text-5xl font-bold tracking-tight">{draft.opportunity_title}</h1>
          <p className="mt-3 text-slate-500">{isReview ? "Previewing your answers before using them on the portal." : (draft.form_schema?.subtitle || "Review and refine your application answers.")}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {!isReview && (
            <>
              <Button variant="outline" className="h-11 rounded-md border-slate-300" onClick={generateAnswers} disabled={generating || saving || fields.length === 0}>
                {generating ? <Loader2 size={14} className="mr-2 animate-spin" /> : <Sparkles size={14} className="mr-2" />} Generate
              </Button>
              <Button className="h-11 rounded-md bg-emerald-700 hover:bg-emerald-800 text-white" onClick={() => saveDraft()} disabled={saving}>
                {saving ? <Loader2 size={14} className="mr-2 animate-spin" /> : <Save size={14} className="mr-2" />} Save
              </Button>
              <Button asChild variant="outline" className="h-11 rounded-md border-slate-300">
                <Link to={`/drafts/${id}?review=true`}><Eye size={14} className="mr-2" /> Review Draft</Link>
              </Button>
            </>
          )}
          {isReview && (
            <Button asChild variant="outline" className="h-11 rounded-md border-slate-300">
              <Link to={`/drafts/${id}`}><FileEdit size={14} className="mr-2" /> Edit Draft</Link>
            </Button>
          )}
          <Button
            className="h-11 rounded-md bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white"
            onClick={() => applyToPortal()}
            disabled={applyBusy || !applyLink}
            data-testid="draft-editor-apply-portal"
          >
            {applyBusy ? <Loader2 size={14} className="mr-2 animate-spin" /> : <ExternalLink size={14} className="mr-2" />} Apply to Portal
          </Button>
        </div>
      </header>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs text-slate-600">
        <DraftJourneyStep icon={FileEdit} title="Start draft" text="Build the answers here first." />
        <DraftJourneyStep icon={ExternalLink} title="Use extension" text="Apply to Portal opens the official form and prepares auto-fill." />
        <DraftJourneyStep icon={CheckCircle2} title="Review and submit" text="Check the filled portal form, submit manually, then mark applied." />
      </section>

      {fields.length === 0 ? (
        <div className="border border-dashed border-slate-300 bg-white p-12 text-center">
          <FileText size={28} className="mx-auto text-slate-400" />
          <div className="mt-4 font-semibold">No application fields captured yet</div>
          <div className="mt-2 text-sm text-slate-500">Use Apply to Portal to open the official form with the extension ready.</div>
        </div>
      ) : (
        <div className="space-y-5">
          {Object.entries(sections).map(([section, sectionFields], index) => (
            <motion.section
              key={section}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: index * 0.05 }}
              className="bg-white border border-slate-200"
            >
              <div className="border-b border-slate-200 px-6 py-4">
                <h2 className="font-display text-xl font-semibold">{section}</h2>
              </div>
              <div className="space-y-5 p-6">
                {sectionFields.map((field) => (
                  <DraftField key={field.id} field={field} value={values[field.id] || ""} onChange={setField} readOnly={isReview} />
                ))}
              </div>
            </motion.section>
          ))}
        </div>
      )}

      <ExtensionInstallModal
        open={showExtensionModal}
        onOpenChange={setShowExtensionModal}
        onVerified={() => applyToPortal({ skipInstallCheck: true })}
        onIgnore={applyWithoutExtension}
      />
    </div>
  );
}

function DraftJourneyStep({ icon: Icon, title, text }) {
  return (
    <div className="flex items-start gap-2 rounded-md bg-white border border-slate-200 px-3 py-2">
      <Icon size={14} className="mt-0.5 text-[var(--accent)] shrink-0" />
      <div>
        <div className="font-semibold text-slate-900">{title}</div>
        <div className="mt-0.5 leading-snug">{text}</div>
      </div>
    </div>
  );
}

function DraftField({ field, value, onChange, readOnly }) {
  const label = (
    <label htmlFor={field.id} className="text-sm font-semibold text-slate-900">
      {field.label} {field.required ? <span className="text-rose-500">*</span> : null}
    </label>
  );

  const shared = {
    id: field.id,
    value,
    placeholder: field.placeholder,
    onChange: (e) => onChange(field.id, e.target.value),
    className: "mt-2 rounded-md border-slate-300 bg-white",
    readOnly,
  };

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        {label}
        {field.max_words ? <span className="text-xs text-slate-400">{field.max_words} words</span> : null}
      </div>
      {field.type === "textarea" ? (
        <Textarea {...shared} rows={5} />
      ) : (
        <Input {...shared} type={["email", "url", "number", "date", "tel"].includes(field.type) ? field.type : "text"} />
      )}
      {field.help_text ? <p className="mt-1.5 text-xs text-slate-500">{field.help_text}</p> : null}
    </div>
  );
}
