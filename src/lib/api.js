// FundMe API client — mirrors the contract of the user's Node/Express server.
// When REACT_APP_BACKEND_URL points at the deployed Node server, this module
// keeps working unchanged.
import axios from "axios";
import { getUserId, clearAuth } from "./auth";

const rawBackend = process.env.REACT_APP_BACKEND_URL || "";
const BACKEND = rawBackend === "undefined" ? "" : rawBackend;
export const API_BASE = `${BACKEND}/api`;

const http = axios.create({ baseURL: API_BASE });

http.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.response?.status === 401) clearAuth();
    return Promise.reject(err);
  }
);

// Convenience: extract human-readable error from upstream `{ error: "..." }`
export const errMsg = (e, fallback = "Something went wrong") =>
  e?.response?.data?.error || e?.response?.data?.detail || e?.message || fallback;

const unwrap = (p) => p.then((r) => r.data);

// Map the real backend opportunity shape to the shape our UI expects.
// Real fields: provider, description, sector (string), no `verified`, no `match` on item.
export const normalizeOpp = (o = {}) => ({
  opportunity_id: o.opportunity_id,
  title: o.title,
  org: o.provider || o.org || "",
  summary: o.description || o.summary || "",
  type: o.type,
  sectors: Array.isArray(o.sector) ? o.sector : (o.sector ? [o.sector] : (o.sectors || [])),
  stage: o.stage || "",
  amount: o.amount || "",
  deadline: o.deadline || "",
  eligibility: o.eligibility || "",
  benefits: Array.isArray(o.benefits) ? o.benefits : [],
  verified: o.credibility_source ? true : Boolean(o.verified),
  link: o.external_apply_url || o.link || "",
  saved: Boolean(o.saved),
  match: o.match_score || o.match || null,
});

// Filter out closed deadlines (mirrors their api.js getOpportunities logic).
const filterOpenDeadlines = (opps) => {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return opps.filter((o) => {
    const d = (o.deadline || "").toLowerCase();
    if (!d || d === "rolling" || d === "not specified" || d === "ongoing") return true;
    const dd = new Date(o.deadline);
    return isNaN(dd) || dd >= today;
  });
};

// ---------- auth ----------
export const apiSignup = (body) => unwrap(http.post("/signup", body));
export const apiLogin = (body) => unwrap(http.post("/login", body));
export const apiGetUser = () => unwrap(http.get(`/user?user_id=${encodeURIComponent(getUserId())}`));
export const apiUpdateUser = (body) => unwrap(http.put("/user", { ...body, user_id: getUserId() }));

// ---------- AI ----------
export const apiGenerateProfile = ({ file, startup_overview, website }) => {
  const fd = new FormData();
  if (file) fd.append("file", file);
  if (startup_overview) fd.append("startup_overview", startup_overview);
  if (website) fd.append("website", website);
  // Explicitly tell axios to let the browser set the boundary for multipart/form-data
  return unwrap(http.post("/ai/generate-profile", fd, { headers: { "Content-Type": undefined } }));
};

// ---------- opportunities ----------
export const apiListOpportunities = async (type) => {
  const raw = await unwrap(http.get(`/opportunities${type ? `?type=${encodeURIComponent(type)}` : ""}`));
  const normalized = filterOpenDeadlines(raw).map(normalizeOpp);
  return applySavedState(normalized);
};

// "Business" view = revenue-oriented opportunities, including live GeM tenders.
const BUSINESS_TYPES = new Set(["Contest", "Fellowship", "Other", "Tender", "Reverse Auction"]);
export const apiListBusinessOpps = async () => {
  const response = await unwrap(http.get("/business-opportunities"));
  const raw = Array.isArray(response) ? response : (response.opportunities || []);
  const normalized = filterOpenDeadlines(raw).filter((o) => BUSINESS_TYPES.has(o.type)).map(normalizeOpp);
  return applySavedState(normalized);
};

// ---------- saved ----------
const savedIdsForCurrentUser = async () => {
  const uid = getUserId();
  if (!uid) return new Set();

  const list = await unwrap(http.get(`/saved?user_id=${encodeURIComponent(uid)}`));
  return new Set(
    list
      .map((row) => row.opportunity_id || row.opportunity?.opportunity_id)
      .filter(Boolean)
  );
};

const applySavedState = async (opportunities) => {
  try {
    const savedIds = await savedIdsForCurrentUser();
    if (savedIds.size === 0) return opportunities;
    return opportunities.map((o) => ({ ...o, saved: o.saved || savedIds.has(o.opportunity_id) }));
  } catch {
    return opportunities;
  }
};

export const apiListSaved = async () => {
  const uid = getUserId();
  const list = await unwrap(http.get(`/saved?user_id=${encodeURIComponent(uid)}`));
  // Their /saved returns saved-opportunity rows joined with opportunity. Some impls
  // return [{opportunity_id, opportunity:{...}}]; others return the merged opp directly.
  return list.map((row) => normalizeOpp(row.opportunity || row)).map((o) => ({ ...o, saved: true }));
};

export const apiSaveOpp = (opportunity_id) =>
  unwrap(http.post("/saved", { user_id: getUserId(), opportunity_id }));

export const apiUnsaveOpp = (opportunity_id) =>
  unwrap(http.delete(`/saved?user_id=${encodeURIComponent(getUserId())}&opportunity_id=${encodeURIComponent(opportunity_id)}`));

// ---------- drafts ----------
const draftProgress = (d = {}) => {
  if (typeof d.progress === "number") return d.progress;
  if (typeof d.completion === "number") return d.completion;
  if (typeof d.completion?.progress === "number") return d.completion.progress;
  return 0;
};

const normalizeDraft = (d = {}) => ({
  draft_id: d.draft_id || d.id,
  opportunity_id: d.opportunity_id,
  opportunity_title: d.opportunity_title || d.opportunity?.title || d.title || "Untitled",
  last_edited: d.last_edited || d.last_saved || d.updated_at || d.created_at || "",
  progress: draftProgress(d),
  status: (d.status || "IN PROGRESS").toUpperCase(),
  deadline: d.deadline || d.opportunity?.deadline || "",
  source_url: d.source_url || "",
  apply_link: d.source_url || d.opportunity?.external_apply_url || d.opportunity?.link || "",
  form_schema: d.form_schema,
  form_fields: d.form_fields || {},
  opportunity: d.opportunity || null,
  required_documents_status: d.required_documents_status || {},
});

export const apiListDrafts = async () => {
  const list = await unwrap(http.get(`/drafts?user_id=${encodeURIComponent(getUserId())}`));
  return list.map(normalizeDraft);
};

export const apiGetDraft = async (draft_id) => normalizeDraft(
  await unwrap(http.get(`/drafts/${draft_id}?user_id=${encodeURIComponent(getUserId())}`))
);

export const apiGetDraftByOpportunity = async (opportunity_id) => {
  try {
    return normalizeDraft(
      await unwrap(http.get(`/drafts/by-opportunity?user_id=${encodeURIComponent(getUserId())}&opportunity_id=${encodeURIComponent(opportunity_id)}`))
    );
  } catch (e) {
    if (e.response?.status === 404) return null;
    throw e;
  }
};

export const apiCreateDraft = async (opportunity_id, source_url = "") =>
  normalizeDraft(await unwrap(http.post("/drafts/bootstrap", {
    user_id: getUserId(),
    opportunity_id,
    source_url,
    form_schema: null,
    schema_source: "manual",
    capture_meta: {},
  })));

export const apiStageExtensionSession = ({ opportunity_id, external_url }) =>
  unwrap(http.post("/extension/session", {
    user_id: getUserId(),
    opportunity_id,
    external_url,
  }));

export const apiUpdateDraft = (draft_id, data) =>
  unwrap(http.put(`/drafts/${draft_id}`, { ...data, user_id: getUserId() }));

export const apiGenerateDraftAnswers = (data) =>
  unwrap(http.post("/ai/generate-draft", { ...data, user_id: getUserId() }));

// ---------- applications ----------
export const apiListApplications = async () => {
  const list = await unwrap(http.get(`/applications?user_id=${encodeURIComponent(getUserId())}`));
  return list.map((a) => ({
    application_id: a.application_id || a.id,
    opportunity_id: a.opportunity_id,
    opportunity_title: a.opportunity_title || a.opportunity?.title || a.title || "Untitled opportunity",
    org: a.provider || a.opportunity?.provider || a.org || "",
    amount: a.amount || a.opportunity?.amount || "",
    match: a.match_score || a.opportunity?.match_score || a.match || 0,
    deadline: a.deadline || a.opportunity?.deadline || "",
    status: a.status || "Applied",
    applied_on: a.applied_on || a.submitted_at || a.created_at || a.applied_at || "",
    next_step: a.next_step || "",
    feedback: a.feedback || "",
    timeline: a.timeline || [],
    opportunity: a.opportunity || null,
  }));
};

export const apiTrackApplication = ({ opportunity_id, deadline }) =>
  unwrap(http.post("/applications", { user_id: getUserId(), opportunity_id, deadline }));

export const apiTrackExternalApplication = ({ opportunity_id, status = "Applied" }) =>
  unwrap(http.post("/applications", { user_id: getUserId(), opportunity_id, status }));

export const apiUpdateApplicationStatus = (application_id, data) =>
  unwrap(http.put(`/applications/${application_id}`, typeof data === "string" ? { status: data } : data));

// ---------- founder profile ----------
export const apiGetProfile = () =>
  unwrap(http.get(`/founder/profile?user_id=${encodeURIComponent(getUserId())}`)).catch((e) => {
    // Their server returns 404 if profile doesn't exist yet — treat as empty.
    if (e.response?.status === 404) return null;
    throw e;
  });

export const apiSaveProfile = async (data) => {
  const body = { user_id: getUserId(), ...data };
  // PUT is the canonical update; if the profile doesn't exist, fall back to POST.
  try {
    return await unwrap(http.put("/founder/profile", body));
  } catch (e) {
    if (e.response?.status === 404) {
      return unwrap(http.post("/founder/profile", body));
    }
    throw e;
  }
};
