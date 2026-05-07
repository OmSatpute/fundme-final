export const getAvatarInitials = (...values) => {
  const label = values.find((value) => typeof value === "string" && value.trim()) || "F";
  const parts = label.trim().split(/\s+/);
  const initials = parts.length > 1 ? `${parts[0][0]}${parts[1][0]}` : parts[0][0];

  return initials.toUpperCase();
};
