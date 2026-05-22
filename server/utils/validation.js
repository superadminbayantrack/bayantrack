export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const PH_PHONE_PATTERN = /^09\d{9}$/;

export function cleanText(value, { max = 500, fallback = '' } = {}) {
  return String(value ?? fallback).replace(/\s+/g, ' ').trim().slice(0, max);
}

export function isValidEmail(value) {
  return EMAIL_PATTERN.test(cleanText(value, { max: 254 }).toLowerCase());
}

export function isValidPhilippineMobile(value) {
  return PH_PHONE_PATTERN.test(cleanText(value, { max: 20 }));
}

export function isValidContact(value) {
  const cleaned = cleanText(value, { max: 254 });
  return isValidEmail(cleaned) || isValidPhilippineMobile(cleaned);
}

export function requireTextFields(source, fields) {
  const missing = fields.filter((field) => !cleanText(source?.[field], { max: 5000 }));
  return missing.length > 0 ? `${missing.join(', ')} required` : '';
}

export function rejectIfTooLong(value, max, label) {
  return String(value || '').length > max ? `${label} is too long. Maximum is ${max} characters.` : '';
}
