import { useEffect, useMemo, useState } from "react";
import { Link, useParams, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, FileText, Loader2, Save, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  apiGenerateDraftAnswers,
  apiGetDraft,
  apiGetProfile,
  apiUpdateDraft,
  errMsg,
} from "@/lib/api";

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

  useEffect(() => {
    setLoading(true);
    apiGetDraft(id)
      .then((data) => {
        setDraft(data);
        setValues(data.form_fields || {});
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

  if (loading) {
    return <div className="flex justify-center py-32"><Loader2 className="animate-spin text-emerald-700" /></div>;
  }

  if (!draft) {
    return (
      <div className="max-w-4xl border border-dashed border-slate-300 bg-white p-12 text-center" data-testid="draft-editor-error">
        <FileText size={28} className="mx-auto text-slate-400" />
        <div className="mt-4 font-semibold">Draft not found</div>
        <Link to="/drafts" className="mt-4 inline-flex text-sm font-medium text-emerald-700">Back to drafts</Link>
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
          <div className="mt-5 text-[10px] uppercase tracking-[0.22em] text-emerald-700 font-bold">{isReview ? "Reviewing draft" : "Application draft"}</div>
          <h1 className="mt-2 font-display text-4xl md:text-5xl font-bold tracking-tight">{draft.opportunity_title}</h1>
          <p className="mt-3 text-slate-500">{isReview ? "Previewing your application answers. Go back to edit." : (draft.form_schema?.subtitle || "Review and refine your application answers.")}</p>
        </div>
        {!isReview && (
          <div className="flex gap-2">
            <Button variant="outline" className="h-11 rounded-md border-slate-300" onClick={generateAnswers} disabled={generating || saving || fields.length === 0}>
              {generating ? <Loader2 size={14} className="mr-2 animate-spin" /> : <Sparkles size={14} className="mr-2" />} Generate
            </Button>
            <Button className="h-11 rounded-md bg-slate-900 hover:bg-slate-800 text-white" onClick={() => saveDraft()} disabled={saving}>
              {saving ? <Loader2 size={14} className="mr-2 animate-spin" /> : <Save size={14} className="mr-2" />} Save
            </Button>
          </div>
        )}
      </header>

      {fields.length === 0 ? (
        <div className="border border-dashed border-slate-300 bg-white p-12 text-center">
          <FileText size={28} className="mx-auto text-slate-400" />
          <div className="mt-4 font-semibold">No application fields captured yet</div>
          <div className="mt-2 text-sm text-slate-500">This draft exists, but it does not have a form schema attached.</div>
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
