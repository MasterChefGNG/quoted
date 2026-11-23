// A test session: Fill in the blanks, Type the full quote and Flashcards, with the feedback panel
// (TestScreen.kt, FillBlanks.kt, TypeFull.kt, Flashcard.kt, QuoteText.kt).
import * as d from './domain.js';
import { vm, MODES } from './state.js';
import { h, icon, mascot, bigButton, card, chip, progressBar, openDialog } from './ui.js';

const MIN_BLANK_PX = 76;
const PX_PER_CHAR = 12;
const MAX_BLANK_PX = 280;
const MAX_MESSAGES = 6;

export function testScreen(session) {
  const answered = session.answers.length > session.index;
  const done = session.index + (answered ? 1 : 0);
  const quote = vm.quoteById.get(session.quoteIds[session.index]);
  const confirmStop = () => openDialog({
    title: 'Stop this session?', text: 'Answers so far are saved.',
    confirm: 'Stop', cancel: 'Keep going', onConfirm: () => vm.go({ name: 'home' }),
  });
  let question;
  if (session.mode === MODES.FillBlanks) question = fillBlanks(quote);
  else if (session.mode === MODES.TypeFull) question = typeFull(quote);
  else question = flashcard(quote);
  return h('div', { class: 'screen' },
    sessionHeader(done, session.index, session.quoteIds.length, 'Stop session', confirmStop), question);
}

/** Close button, progress bar and "3 / 10", shared by test and learn sessions. */
export function sessionHeader(done, index, total, closeLabel, onClose) {
  return h('div', { class: 'session-header' },
    h('button', { type: 'button', class: 'round-button grey', 'aria-label': closeLabel, onClick: onClose }, icon('close', 28)),
    progressBar(done / total),
    h('span', { class: 'secondary strong', text: `${index + 1} / ${total}` }));
}

/**
 * Shared question layout: title, scrolling body, and a bottom area for the button or feedback.
 * While an answer box has focus (the keyboard is up) the screen gets a "typing" class that hides
 * the title, as the Android app does.
 */
export function questionLayout(title, body, bottom) {
  const root = h('div', { class: 'question' },
    h('div', { class: 'question-scroll' }, h('h1', { class: 'title question-title', text: title }), body),
    bottom);
  // Only on touch screens: a laptop has no on-screen keyboard to make room for.
  if (!window.matchMedia('(pointer: coarse)').matches) return root;
  root.addEventListener('focusin', (e) => { if (e.target.matches('input, textarea')) root.classList.add('typing'); });
  root.addEventListener('focusout', () => {
    // Wait a moment: focus may be moving to the next blank.
    setTimeout(() => { if (!root.contains(document.activeElement) || !document.activeElement.matches('input, textarea')) root.classList.remove('typing'); }, 60);
  });
  return root;
}

export function chipRow(quote, showThemes, centered = false) {
  return h('div', { class: centered ? 'chip-flow centered' : 'chip-flow' },
    chip(quote.speakerLabel, true), chip(quote.actScene), showThemes ? quote.themes.map((t) => chip(t)) : null);
}

/**
 * The quote with its verse line breaks. Highlighted tokens (wrong or missing) get full yellow;
 * slipped tokens (accepted with a typo) get a paler yellow so the real spelling still stands out.
 */
export function quoteText(quote, highlighted = new Set(), slipped = new Set(), cls = 'quote') {
  const el = h('p', { class: cls });
  quote.tokens.forEach((token, i) => {
    if (i > 0) el.append(token.startsLine ? h('br') : ' ');
    if (highlighted.has(i)) el.append(h('mark', { text: token.text }));
    else if (slipped.has(i)) el.append(h('mark', { class: 'slip', text: token.text }));
    else el.append(token.text);
  });
  return el;
}

const slipMessage = (typed, real) => `Small slip: you wrote "${typed}", it's "${real}"`;

/** Which token each normalised word belongs to. */
const wordToToken = (quote) => quote.tokens.flatMap((token, t) => token.words.map(() => t));

/** The real word as written in the quote, for messages ("father's" rather than "fathers"). */
function realWordShown(quote, wordIndex) {
  const token = quote.tokens[wordToToken(quote)[wordIndex]];
  return token.words.length === 1 ? token.core : quote.words[wordIndex];
}

const limitMessages = (all) =>
  (all.length <= MAX_MESSAGES ? all : [...all.slice(0, MAX_MESSAGES), `…and ${all.length - MAX_MESSAGES} more`]);

function fullMarkMessages(quote, mark) {
  return limitMessages(mark.diffs.map((x) => {
    if (x.kind === 'wrong') return `You wrote "${x.typed}" instead of "${realWordShown(quote, x.realIndex)}"`;
    if (x.kind === 'missing') return `You left out "${realWordShown(quote, x.realIndex)}"`;
    if (x.kind === 'extra') return `You added "${x.typed}"`;
    return x.typed !== null ? slipMessage(x.typed, realWordShown(quote, x.realIndex)) : null;
  }).filter((m) => m !== null));
}

/** The panel that slides up after Check. */
function feedbackPanel({ good, heading, percent, quoteEl, messages }) {
  const cont = bigButton('Continue', () => vm.next());
  const panel = h('div', { class: good ? 'feedback good' : 'feedback bad', role: 'status' },
    h('div', { class: 'feedback-scroll' },
      h('div', { class: 'feedback-head' },
        h('span', { class: 'feedback-icon' }, icon(good ? 'check' : 'cross', 24)),
        h('span', { class: 'title feedback-heading', text: heading }),
        percent !== null ? h('span', { class: 'title', text: `${percent}%` }) : null),
      quoteEl,
      h('div', { class: 'feedback-messages' }, messages.map((m) => h('p', { class: 'body', text: m })))),
    cont);
  return panel;
}

const bottomButton = (text, onClick, enabled = true) => h('div', { class: 'bottom-bar' }, bigButton(text, onClick, { enabled }));

// ---------- Fill in the blanks ----------

function fillBlanks(quote) {
  const blanks = [...vm.blanksFor(quote)].sort((a, b) => a - b);
  const inputs = new Map();
  const bottom = h('div', { class: 'question-bottom hide-while-typing' });
  let checked = false;

  const check = () => {
    if (checked) return;
    checked = true;
    document.activeElement?.blur();
    const real = (i) => quote.tokens[i].words[0];
    const value = (i) => inputs.get(i).value;
    const results = new Map(blanks.map((i) => [i, d.markBlank(value(i), real(i))]));
    const wrong = blanks.filter((i) => !results.get(i));
    const slips = blanks.filter((i) => results.get(i) && !d.isExactBlank(value(i), real(i)));
    for (const [i, ok] of results) {
      inputs.get(i).readOnly = true;
      inputs.get(i).classList.add(ok ? 'right' : 'wrong');
    }
    vm.answer(wrong.length === 0);
    hint.remove();
    bottom.classList.remove('hide-while-typing');
    bottom.replaceChildren(feedbackPanel({
      good: wrong.length === 0,
      heading: wrong.length === 0 ? 'Correct' : 'Not quite',
      percent: null,
      quoteEl: quoteText(quote, new Set(wrong), new Set(slips)),
      messages: limitMessages([
        ...wrong.map((i) => (value(i).trim() === ''
          ? `You left out "${quote.tokens[i].core}"`
          : `You wrote "${value(i).trim()}" instead of "${quote.tokens[i].core}"`)),
        ...slips.map((i) => slipMessage(value(i).trim(), quote.tokens[i].core)),
      ]),
    }));
  };

  const box = h('div', { class: 'blanks-box' });
  let line = h('div', { class: 'blank-line' });
  box.append(line);
  quote.tokens.forEach((token, i) => {
    if (token.startsLine) { line = h('div', { class: 'blank-line' }); box.append(line); }
    if (!blanks.includes(i)) {
      line.append(h('span', { class: 'quote-word', text: token.text }));
      return;
    }
    const start = Math.max(token.text.indexOf(token.core), 0);
    const prefix = token.text.slice(0, start);
    const suffix = token.text.slice(start + token.core.length);
    const isLast = blanks.indexOf(i) === blanks.length - 1;
    const input = h('input', {
      type: 'text', class: 'blank', 'aria-label': 'Blank word',
      autocomplete: 'off', autocorrect: 'off', autocapitalize: 'none', spellcheck: 'false',
      enterkeyhint: isLast ? 'done' : 'next',
    });
    const size = () => { input.style.width = `${Math.min(MIN_BLANK_PX + input.value.length * PX_PER_CHAR, MAX_BLANK_PX)}px`; };
    size();
    input.addEventListener('input', size);
    input.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      // The keyboard's Next/Done key moves on, and checks after the last blank.
      const next = blanks[blanks.indexOf(i) + 1];
      if (next !== undefined) inputs.get(next).focus();
      else check();
    });
    inputs.set(i, input);
    line.append(h('span', { class: 'blank-token' }, prefix ? h('span', { class: 'quote-word', text: prefix }) : null, input,
      suffix ? h('span', { class: 'quote-word', text: suffix }) : null));
  });

  const hint = h('p', { class: 'secondary center hint', text: "Capitals and punctuation don't matter" });
  bottom.append(h('div', { class: 'bottom-bar' }, bigButton('Check', check)));
  const layout = questionLayout('Fill in the blanks', [chipRow(quote, false), box, hint], bottom);
  setTimeout(() => inputs.get(blanks[0])?.focus(), 50);
  return layout;
}

// ---------- Type the full quote ----------

function typeFull(quote) {
  const area = h('textarea', {
    class: 'answer', 'aria-label': 'Your answer', rows: '4',
    autocomplete: 'off', autocorrect: 'off', autocapitalize: 'none', spellcheck: 'false',
  });
  const bottom = h('div', { class: 'question-bottom' });
  const check = () => {
    if (area.value.trim() === '') return;
    const m = d.markFull(area.value, quote.words);
    area.readOnly = true;
    area.blur();
    vm.answer(m.isCorrect);
    const toToken = wordToToken(quote);
    let heading = 'Not quite';
    if (m.percent >= 100 && m.isWordPerfect) heading = 'Word perfect';
    else if (m.isCorrect) heading = 'Nearly word perfect';
    bottom.replaceChildren(feedbackPanel({
      good: m.isCorrect, heading, percent: m.percent,
      quoteEl: quoteText(quote, new Set([...m.wrongRealIndices].map((i) => toToken[i])),
        new Set(m.slips.map((s) => toToken[s.realIndex]))),
      messages: fullMarkMessages(quote, m),
    }));
  };
  const checkButton = bigButton('Check', check, { enabled: false });
  area.addEventListener('input', () => {
    const ready = area.value.trim() !== '';
    checkButton.disabled = !ready;
    checkButton.className = `big-button raised ${ready ? 'primary' : 'disabled'}`;
  });
  bottom.append(h('div', { class: 'bottom-bar' }, checkButton));
  const layout = questionLayout('Type the full quote', [
    chipRow(quote, true),
    h('p', { class: 'secondary starts-with', text: d.startsWithHint(quote) }),
    h('div', { class: 'label answer-label', text: 'YOUR ANSWER' }),
    area,
  ], bottom);
  layout.classList.add('type-full');
  setTimeout(() => area.focus(), 50);
  return layout;
}

// ---------- Flashcards ----------

function flashcard(quote) {
  let marked = false;
  const front = h('div', { class: 'face front' },
    chipRow(quote, true, true),
    h('p', { class: 'quote-big center', text: d.startsWithHint(quote) }),
    h('p', { class: 'secondary center', text: 'Say or think the whole quote, then flip.' }));
  const back = h('div', { class: 'face back' },
    mascot(64), quoteText(quote, undefined, undefined, 'quote-big center'), chipRow(quote, true, true));
  const flipper = h('div', { class: 'flipper' }, front, back);
  const cardEl = card(flipper, { cls: 'flashcard', onClick: () => flip() });
  cardEl.setAttribute('aria-label', 'Flashcard, tap to flip');

  // One mark per card: a quick double tap must not also mark the next card.
  const mark = (isCorrect) => {
    if (marked) return;
    marked = true;
    vm.answer(isCorrect);
    vm.next();
  };
  const below = h('div', { class: 'flash-below' });
  const showBelow = (flipped) => below.replaceChildren(...(flipped
    ? [h('p', { class: 'secondary center', text: 'Did you have it word for word?' }),
      h('div', { class: 'two-buttons' },
        bigButton('Missed it', () => mark(false), { primary: false }),
        bigButton('Got it', () => mark(true)))]
    : [h('p', { class: 'secondary center tap-hint', text: 'Tap the card to flip it' })]));
  let flipped = false;
  const flip = () => {
    flipped = !flipped;
    flipper.classList.toggle('flipped', flipped);
    showBelow(flipped);
  };
  showBelow(false);
  return h('div', { class: 'flash-screen' }, h('h1', { class: 'title question-title', text: 'Flashcards' }), cardEl, below);
}
