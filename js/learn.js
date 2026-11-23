// Learn: the fade-out drill and its finish screen (LearnScreen.kt).
import * as d from './domain.js';
import { vm } from './state.js';
import { h, mascot, bigButton, card, progressBar, setProgress, smallLink } from './ui.js';
import { sessionHeader, questionLayout, chipRow } from './test-screen.js';

export function learnScreen(learn) {
  const quote = vm.quoteById.get(learn.quoteIds[learn.index]);
  const isLast = learn.index + 1 === learn.quoteIds.length;
  return h('div', { class: 'screen' },
    sessionHeader(learn.index, learn.index, learn.quoteIds.length, 'Stop learning', () => vm.go({ name: 'home' })),
    fadeDrill(quote, isLast));
}

function stepHint(step, steps) {
  if (step === 0) return 'Read it out loud a few times, then tap Hide more.';
  if (step === steps) return 'Say the whole quote from memory. Tap a gap to peek.';
  return "Say the whole quote, gaps and all. Tap a gap if you're stuck.";
}

/** Read the quote, then hide more words each step until you're saying it from memory. */
function fadeDrill(quote, isLast) {
  let order = vm.fadeOrderFor(quote);
  let step = 0;
  let peeked = new Set();

  const quoteBox = h('div', { class: 'fading-quote' });
  const hint = h('p', { class: 'body grey-text step-hint' });
  const bar = progressBar(0, { thin: true });
  const bottom = h('div', { class: 'learn-bottom' });

  let nextShownAt = 0;
  const goTo = (newStep) => {
    step = newStep;
    peeked = new Set();
    if (newStep === d.fadeSteps(order)) nextShownAt = performance.now();
    draw();
  };
  const next = () => { if (d.isTapAllowed(performance.now(), nextShownAt)) vm.learnNext(); };

  function drawQuote(hidden) {
    const lines = [];
    quote.tokens.forEach((token, i) => {
      if (lines.length === 0 || token.startsLine) lines.push([]);
      lines[lines.length - 1].push(i);
    });
    quoteBox.replaceChildren(...lines.map((line) => h('div', { class: 'fade-line' }, line.map((i) => {
      const text = quote.tokens[i].text;
      if (!hidden.has(i)) return h('span', { class: 'quote-big', text });
      const shown = peeked.has(i);
      // A grey block exactly as wide as the word; peeking shows it on a yellow highlight.
      return h('button', {
        type: 'button', class: shown ? 'gap shown' : 'gap',
        'aria-label': shown ? text : 'Hidden word, tap to peek',
        onClick: () => { if (peeked.has(i)) peeked.delete(i); else peeked.add(i); draw(); },
      }, h('span', { class: 'quote-big', text }));
    }))));
  }

  function draw() {
    const steps = d.fadeSteps(order);
    drawQuote(d.hiddenAtStep(order, step));
    hint.textContent = stepHint(step, steps);
    setProgress(bar, step / steps);
    bottom.replaceChildren(...(step < steps
      ? [bigButton('Hide more', () => goTo(step + 1)), smallLink('Show more words', () => goTo(step - 1), step > 0)]
      : [bigButton(isLast ? 'Finish' : 'I know it', next),
        smallLink('Go through it again', () => { order = vm.fadeOrderFor(quote); goTo(0); })]));
  }
  draw();

  return questionLayout('Learn it', [card(quoteBox), h('div', { class: 'gap-top' }, chipRow(quote, true)), hint, bar], bottom);
}

export function learnDoneScreen(done) {
  const count = done.quoteIds.length;
  return h('div', { class: 'screen' },
    h('div', { class: 'done-middle' },
      mascot(110),
      h('h1', { class: 'hero center', text: count === 1 ? '1 quote learned' : `${count} quotes learned` }),
      h('p', { class: 'secondary center', text: "Test yourself now, while they're fresh." })),
    h('div', { class: 'bottom-stack' },
      bigButton('Test me on these', () => vm.testLearned(done.quoteIds)),
      bigButton('Done', () => vm.go({ name: 'home' }), { primary: false })));
}
