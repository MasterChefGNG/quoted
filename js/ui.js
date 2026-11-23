// Shared building blocks: a tiny element helper, icons, the mascot and the components from the Android
// app's ui/Components.kt (raised cards, big buttons, chips, progress bar, sheets and dialogs).

/**
 * Creates an element. Props starting with "on" become listeners; `class`, `style`, `text` and `html`
 * are handled specially; anything else is set as an attribute. Children can be nodes, strings or arrays.
 * @returns {HTMLElement}
 */
export function h(tag, props = {}, ...children) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(props ?? {})) {
    if (value === null || value === undefined || value === false) continue;
    if (key.startsWith('on')) el.addEventListener(key.slice(2).toLowerCase(), value);
    else if (key === 'class') el.className = value;
    else if (key === 'style') Object.assign(el.style, value);
    else if (key === 'text') el.textContent = value;
    else if (key === 'html') el.innerHTML = value; // only ever used with the app's own SVG strings
    else el.setAttribute(key, value === true ? '' : value);
  }
  append(el, children);
  return el;
}

function append(el, children) {
  for (const child of children.flat(Infinity)) {
    if (child === null || child === undefined || child === false) continue;
    el.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
}

// ---------- Icons (same line drawings as ui/Icons.kt) ----------

const ICONS = {
  sliders: [2, 'M4 8H13M17 8H20M13 8a2 2 0 1 0 4 0a2 2 0 1 0-4 0M4 16H7M11 16H20M7 16a2 2 0 1 0 4 0a2 2 0 1 0-4 0'],
  blanks: [2.4, 'M3 9H8M11 9H13M16 9H21M3 15H5M8 15H21'],
  pencil: [2.4, 'M4 20V16L15 5L19 9L8 20ZM14 20H20'],
  cards: [2.4, 'M4 8V20H16M8 4H20V16H8Z'],
  book: [2.2, 'M12 6.5C10 5 7 4.5 3.5 5V18.5C7 18 10 18.5 12 20C14 18.5 17 18 20.5 18.5V5C17 4.5 14 5 12 6.5ZM12 6.5V20'],
  flame: [2.2, 'M12 3C15 7 18 10 18 14.5C18 18.2 15.3 21 12 21C8.7 21 6 18.2 6 14.5C6 11.6 7.6 9.6 9 8C9.4 10 10.4 11.2 11.6 11.4C11.4 8.2 11 5.4 12 3Z'],
  close: [2.8, 'M6 6L18 18M18 6L6 18'],
  back: [2.8, 'M15 5L8 12L15 19'],
  check: [3.2, 'M5 12.5L10 17L19 7'],
  cross: [3.2, 'M7 7L17 17M17 7L7 17'],
};

/** An inline SVG icon drawn in the current text colour. */
export function icon(name, size = 24, cls = '') {
  const [width, path] = ICONS[name];
  return h('span', {
    class: `icon ${cls}`,
    'aria-hidden': 'true',
    style: { width: `${size}px`, height: `${size}px` },
    html: `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"><path d="${path}"/></svg>`,
  });
}

/** The quoted mascot: an inkpot with a face and a quill (res/drawable/mascot.xml). */
export const MASCOT_SVG = `<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg">
<path d="M57,56 C58,34 76,14 99,5 C96,26 82,44 66,56 Z" fill="#FFFFFF" stroke="#1F2937" stroke-width="3.5" stroke-linejoin="round"/>
<path d="M61,54 L93,13 M72,40 L80,42 M78,32 L86,34" fill="none" stroke="#1F2937" stroke-width="2.5" stroke-linecap="round"/>
<path d="M45,50 h30 v12 h-30 z" fill="#1F2937"/>
<path d="M44,55 h32 a3,3 0 0 1 0,7 h-32 a3,3 0 0 1 0,-7 z" fill="#1B7F45"/>
<path d="M38,62 h44 a20,20 0 0 1 20,20 v8 a20,20 0 0 1 -20,20 h-44 a20,20 0 0 1 -20,-20 v-8 a20,20 0 0 1 20,-20 z" fill="#1F2937"/>
<path d="M37,82 a9,9 0 1 0 18,0 a9,9 0 1 0 -18,0 z M65,82 a9,9 0 1 0 18,0 a9,9 0 1 0 -18,0 z" fill="#FFFFFF"/>
<path d="M44,83 a4.5,4.5 0 1 0 9,0 a4.5,4.5 0 1 0 -9,0 z M72,83 a4.5,4.5 0 1 0 9,0 a4.5,4.5 0 1 0 -9,0 z" fill="#1F2937"/>
<path d="M52,97 Q60,103 68,97" fill="none" stroke="#FFFFFF" stroke-width="4" stroke-linecap="round"/>
</svg>`;

export const mascot = (size) =>
  h('div', { class: 'mascot', 'aria-hidden': 'true', style: { width: `${size}px`, height: `${size}px` }, html: MASCOT_SVG });

// ---------- Components ----------

/** Full-width capitalised button. Primary is green; secondary is white with a grey edge. */
export function bigButton(text, onClick, { primary = true, enabled = true, badge = null, cls = '' } = {}) {
  const kind = !enabled ? 'disabled' : primary ? 'primary' : 'secondary';
  return h('button', {
    type: 'button',
    class: `big-button raised ${kind} ${cls}`,
    disabled: !enabled,
    // Always attached: a disabled button gets no clicks, and enabling it later must make it work.
    onClick,
  },
  h('span', { class: 'big-button-text', text }),
  badge !== null ? h('span', { class: 'badge', text: String(badge) }) : null);
}

/** A white card with a grey edge that sinks when pressed. Without onClick it is a plain card. */
export function card(children, { onClick = null, cls = '' } = {}) {
  const tag = onClick ? 'button' : 'div';
  return h(tag, { type: onClick ? 'button' : null, class: `card raised ${cls}`, onClick }, children);
}

export const chip = (text, green = false) => h('span', { class: green ? 'chip green' : 'chip', text });

/** A chip that toggles, for filters and choices. */
export const toggleChip = (text, selected, onClick) =>
  h('button', { type: 'button', class: selected ? 'chip toggle selected' : 'chip toggle', 'aria-pressed': String(selected), onClick, text });

export function progressBar(fraction, { thin = false } = {}) {
  const fill = h('div', { class: 'progress-fill' });
  const bar = h('div', { class: thin ? 'progress thin' : 'progress', role: 'progressbar' }, fill);
  setProgress(bar, fraction);
  return bar;
}

export function setProgress(bar, fraction) {
  const f = Math.min(Math.max(fraction, 0), 1);
  bar.firstChild.style.width = `${f * 100}%`;
  bar.firstChild.style.display = f > 0 ? '' : 'none';
  bar.setAttribute('aria-valuenow', String(Math.round(f * 100)));
}

/** The small underlined text link under a main button. */
export const smallLink = (text, onClick, enabled = true) =>
  h('button', { type: 'button', class: 'small-link', disabled: !enabled, onClick: enabled ? onClick : null, text });

/** Back arrow and title, for the Quote list and Settings. */
export const topBar = (title, onBack) =>
  h('div', { class: 'top-bar' },
    h('button', { type: 'button', class: 'round-button', 'aria-label': 'Back', onClick: onBack }, icon('back', 28)),
    h('h1', { class: 'title', text: title }));

/** Section label ("HOW MANY QUOTES"). */
export const label = (text, cls = '') => h('div', { class: `label ${cls}`, text: text.toUpperCase() });

// ---------- Overlays ----------

let overlayRoot = null;
export const setOverlayRoot = (el) => { overlayRoot = el; };

/** Removes every open sheet and dialog (used when the screen changes). */
export function closeOverlays() {
  overlayRoot?.replaceChildren();
}

/**
 * A bottom sheet over a dimmed backdrop. `build(close)` returns the sheet's content.
 * Tapping the backdrop closes it, like Android's ModalBottomSheet.
 */
export function openSheet(build) {
  const backdrop = h('div', { class: 'backdrop' });
  const sheet = h('div', { class: 'sheet', role: 'dialog', 'aria-modal': 'true' });
  const close = () => {
    sheet.classList.remove('open');
    backdrop.classList.remove('open');
    setTimeout(() => { backdrop.remove(); sheet.remove(); }, 220);
  };
  backdrop.addEventListener('click', close);
  sheet.append(h('div', { class: 'sheet-handle' }), build(close));
  overlayRoot.append(backdrop, sheet);
  requestAnimationFrame(() => { backdrop.classList.add('open'); sheet.classList.add('open'); });
  return close;
}

/** A small alert dialog with a confirm and a cancel action. */
export function openDialog({ title, text, confirm, cancel, onConfirm, danger = false }) {
  const backdrop = h('div', { class: 'backdrop open center' });
  const close = () => backdrop.remove();
  const box = h('div', { class: 'dialog', role: 'alertdialog', 'aria-modal': 'true' },
    h('div', { class: 'card-title', text: title }),
    h('p', { class: 'body', text }),
    h('div', { class: 'dialog-actions' },
      h('button', { type: 'button', class: 'text-button grey', text: cancel, onClick: close }),
      h('button', {
        type: 'button', class: danger ? 'text-button amber' : 'text-button green', text: confirm,
        onClick: () => { close(); onConfirm(); },
      })));
  backdrop.addEventListener('click', (e) => { if (e.target === backdrop) close(); });
  backdrop.append(box);
  overlayRoot.append(backdrop);
}
