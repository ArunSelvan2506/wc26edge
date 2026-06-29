// Small UI helpers shared across components.

export const cc    = p => (p >= 75 ? 'var(--grn)' : p >= 55 ? 'var(--amb)' : 'var(--red)');
export const cpill = p => (p >= 75 ? 'cp-hi' : p >= 55 ? 'cp-md' : 'cp-lo');
export const cfill = p => (p >= 75 ? 'f-hi' : p >= 55 ? 'f-md' : 'f-lo');
export const ecls  = cf => (cf >= 75 ? 'ec-hi' : 'ec-md');

// Copy text to clipboard and fire a toast. Decoupled via a window event so any
// component can copy without prop-drilling a toast handler.
export function copyText(text) {
  const t = String(text);
  const done = () => window.dispatchEvent(new CustomEvent('wc-toast', { detail: 'Copied · ' + t }));
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(t).then(done, fallbackCopy.bind(null, t, done));
    } else fallbackCopy(t, done);
  } catch { fallbackCopy(t, done); }
}
function fallbackCopy(t, done) {
  try {
    const ta = document.createElement('textarea');
    ta.value = t; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select(); document.execCommand('copy');
    document.body.removeChild(ta);
  } catch { /* ignore */ }
  done();
}
