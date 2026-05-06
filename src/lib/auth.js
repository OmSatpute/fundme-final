// Local-storage-backed auth — matches the FundMe Node server's stateless model.
const KEY = "fundme_user_id";
const USER_KEY = "fundme_user";

export const getUserId = () => {
  try { return localStorage.getItem(KEY) || null; } catch { return null; }
};

export const getUser = () => {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
};

export const setAuth = (user) => {
  if (!user || !user.user_id) return;
  localStorage.setItem(KEY, user.user_id);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
};

export const clearAuth = () => {
  localStorage.removeItem(KEY);
  localStorage.removeItem(USER_KEY);
};

export const isAuthed = () => !!getUserId();

// Password rule: ≥8 chars, ≥1 uppercase, ≥1 number.
export const passwordRules = [
  { test: (p) => p.length >= 8, label: "At least 8 characters" },
  { test: (p) => /[A-Z]/.test(p), label: "One uppercase letter" },
  { test: (p) => /[0-9]/.test(p), label: "One number" },
];

export const validatePassword = (p) => passwordRules.every((r) => r.test(p || ""));
