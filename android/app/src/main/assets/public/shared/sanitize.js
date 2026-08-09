// Escapes a value for safe interpolation into an innerHTML template
// literal. Used anywhere we render text that ultimately comes from
// outside our own static markup — AI-generated report/quiz content,
// or the user's own speech-to-text transcript. That content is just
// text as far as the product is concerned, but if it were ever
// injected into innerHTML unescaped, any HTML-like characters in it
// (e.g. a stray "<" from a transcription glitch, or a model output
// that happens to contain "<img onerror=...>") would be parsed as
// markup instead of displayed as text. Wrapping every such value in
// escapeHtml() keeps it as inert, literal text no matter what it
// contains.
//
// Deliberately NOT used on: our own static markup strings, CSS class
// names we control, or purely numeric/computed values (e.g. SVG
// stroke-dasharray numbers) — escaping those would be pointless.
export function escapeHtml(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
