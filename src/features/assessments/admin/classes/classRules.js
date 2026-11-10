/** Client-side mirror of obvious form rules; the server is authoritative. */

export function validateClassForm(form) {
  const errors = {};
  if (!form.code.trim()) errors.code = "Enter a class code.";
  if (!form.title.trim()) errors.title = "Enter a title.";
  return errors;
}

export function validateModuleForm(form) {
  const errors = {};
  if (!form.title.trim()) errors.title = "Enter a title.";
  if (!form.body.trim()) errors.body = "Enter the lesson text.";
  const order = String(form.order ?? "").trim();
  if (!/^\d+$/.test(order) || Number(order) < 1) errors.order = "Order must be a whole number of 1 or more.";
  return errors;
}

/** Move the module at `index` one place; returns a new array or the same one when it cannot move. */
export function moveItem(list, index, delta) {
  const target = index + delta;
  if (target < 0 || target >= list.length) return list;
  const next = [...list];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

export const TYPE_LABELS = { aud: "Audio", vid: "Video", doc: "Document" };
