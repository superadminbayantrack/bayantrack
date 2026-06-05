export const PERSON_NAME_PATTERN = /^[\p{L}\p{M}][\p{L}\p{M} .'-]*$/u;

export function cleanPersonNameInput(value: string, max = 140) {
  return value
    .replace(/[^\p{L}\p{M} .'-]/gu, "")
    .replace(/\s{2,}/g, " ")
    .slice(0, max);
}

export function isValidPersonName(value: string, { required = true } = {}) {
  const cleaned = value.replace(/\s+/g, " ").trim();
  if (!cleaned) return !required;
  const letterCount = cleaned.match(/\p{L}/gu)?.length || 0;
  return letterCount >= 2 && PERSON_NAME_PATTERN.test(cleaned);
}

export function personNameMessage(label = "Name") {
  return `${label} must contain letters only. Numbers and special symbols are not allowed.`;
}
