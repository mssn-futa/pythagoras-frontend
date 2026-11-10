// Canonical event category tokens (lead decision; D4 automation sources).
// Event.category stays a free string for legacy/non-automation events.

export const EVENT_CATEGORIES = Object.freeze([
  { value: "dawah_night", label: "Da'wah Night" },
  { value: "usroh", label: "Usroh" },
  { value: "special_lecture", label: "Special lecture" },
  { value: "jumuah", label: "Jumu'ah" },
]);

export const isCanonicalCategory = (value) => EVENT_CATEGORIES.some((category) => category.value === value);

/** Human label for a canonical token; any other text is shown as typed. */
export function categoryLabel(value) {
  const text = typeof value === "string" ? value.trim() : "";
  return EVENT_CATEGORIES.find((category) => category.value === text)?.label ?? text;
}
