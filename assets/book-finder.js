import { addToCart } from '@theme/cart-add';

/**
 * Book finder (sections/book-finder.liquid): four questions, one at a time, then the
 * best matching books from the JSON the section renders, as cards with Add to cart.
 *
 * Scoring, per book:
 * - format: a book without the chosen format is left out ("any" keeps all).
 * - subject: a book of another subject is left out; the chosen one +5. "A bit of
 *   everything" gives +3 to books covering two or more subjects (bundles).
 * - age (ages): same band +3, next band +1.
 * - reading level (levels): same level +4, one level away +2.
 * Books with no subject and books scoring 0 are never shown. Ties keep available books first, then collection order.
 */
const AGES = ['0-2', '3-5', '6-8', '9-12'];
const LEVELS = ['Pre-reader', 'Emerging reader', 'Early reader', 'Independent reader', 'Confident reader'];
const SUBJECTS = { reading: 'Reading', writing: 'Writing', math: 'Math' };
const STEPS = ['age', 'subject', 'level', 'format'];

/** @param {string} value */
const escape = (value) =>
  String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

/** Smallest distance between a value and any of a book's values, in an ordered list. */
const nearest = (list, values, answer) => {
  const target = list.indexOf(answer);
  if (target === -1) return { distance: Infinity };
  let best = { distance: Infinity, value: '' };
  for (const value of values || []) {
    const index = list.indexOf(value);
    if (index === -1) continue;
    const distance = Math.abs(index - target);
    if (distance < best.distance) best = { distance, value };
  }
  return best;
};

class BookFinder extends HTMLElement {
  /** @type {Record<string, string>} */
  #answers = {};
  #step = 0;
  #books = [];

  /** Mouse drag on the results track. */
  #drag = { active: false, startX: 0, scrollLeft: 0, moved: false };

  connectedCallback() {
    try {
      this.#books = JSON.parse(this.querySelector('[data-books]')?.textContent || '[]');
    } catch {
      this.#books = [];
    }
    this.addEventListener('click', this.#onClick, { capture: true });

    const track = this.#track;
    track?.addEventListener('scroll', this.#updateArrows, { passive: true });
    track?.addEventListener('pointerdown', this.#onPointerDown);
    window.addEventListener('pointermove', this.#onPointerMove);
    window.addEventListener('pointerup', this.#onPointerUp);
    window.addEventListener('resize', this.#updateArrows);
  }

  disconnectedCallback() {
    this.removeEventListener('click', this.#onClick, { capture: true });
    window.removeEventListener('pointermove', this.#onPointerMove);
    window.removeEventListener('pointerup', this.#onPointerUp);
    window.removeEventListener('resize', this.#updateArrows);
  }

  get #track() {
    return /** @type {HTMLElement|null} */ (this.querySelector('[data-picks]'));
  }

  #onClick = (event) => {
    const target = /** @type {HTMLElement} */ (event.target);

    // A drag that ends over a card isn't a click on its link or button.
    if (this.#drag.moved && target.closest('[data-picks]')) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    if (target.closest('[data-prev]')) {
      this.#slide(-1);
      return;
    }
    if (target.closest('[data-next]')) {
      this.#slide(1);
      return;
    }

    const add = /** @type {HTMLButtonElement|null} */ (target.closest('[data-add]'));
    if (add) {
      this.#add(add);
      return;
    }

    const option = /** @type {HTMLElement|null} */ (target.closest('[data-question]'));
    if (option) {
      const { question, value } = option.dataset;
      this.#answers[question] = value;
      option.parentElement?.querySelectorAll('[data-question]').forEach((el) => {
        el.classList.toggle('is-selected', el === option);
      });
      this.#show(this.#step + 1);
      return;
    }

    if (target.closest('[data-back]')) this.#show(this.#step - 1);
    else if (target.closest('[data-restart]')) {
      this.#answers = {};
      this.querySelectorAll('.is-selected').forEach((el) => el.classList.remove('is-selected'));
      this.#show(0);
    }
  };

  /** @param {number} step 0–3 for the questions, 4 for the results. */
  #show(step) {
    this.#step = Math.max(0, Math.min(step, STEPS.length));
    const done = this.#step === STEPS.length;

    // Drives the step colour of the frame, the progress segments and the accents.
    this.dataset.stage = done ? 'results' : STEPS[this.#step];

    this.querySelectorAll('[data-step]').forEach((el) => {
      /** @type {HTMLElement} */ (el).hidden = Number(el.dataset.step) !== this.#step;
    });

    const results = /** @type {HTMLElement} */ (this.querySelector('[data-results]'));
    results.hidden = !done;
    /** @type {HTMLElement} */ (this.querySelector('[data-progress]')).hidden = done;
    /** @type {HTMLElement} */ (this.querySelector('[data-back]')).hidden = this.#step === 0;
    /** @type {HTMLElement} */ (this.querySelector('[data-restart]')).hidden = !done;

    const number = this.querySelector('[data-step-number]');
    if (number) number.textContent = String(this.#step + 1);

    if (done) {
      this.#renderResults();
      results.focus({ preventScroll: true });
    } else {
      /** @type {HTMLElement|null} */ (this.querySelector(`[data-step="${this.#step}"] [data-question]`))?.focus({
        preventScroll: true,
      });
    }
  }

  #recommend() {
    const { age, subject, level, format } = this.#answers;

    return this.#books
      .map((book, order) => {
        if (format === 'physical' && !book.physical) return null;
        if (format === 'digital' && !book.digital) return null;

        // Products with no subject (a plush toy, an untagged book) are never picked.
        const subjects = book.subjects || [];
        if (!subjects.length) return null;

        let score = 0;
        const why = [];

        if (subject === 'all') {
          if (subjects.length >= 2) {
            score += 3;
            why.push(subjects.map((s) => SUBJECTS[s]).join(' + '));
          }
        } else {
          if (!subjects.includes(subject)) return null;
          score += 5;
          why.push(SUBJECTS[subject]);
        }

        const ageMatch = nearest(AGES, book.ages, age);
        if (ageMatch.distance === 0) score += 3;
        else if (ageMatch.distance === 1) score += 1;
        if (ageMatch.distance <= 1) why.push(`Ages ${ageMatch.value.replace('-', '–')}`);

        const levelMatch = nearest(LEVELS, book.levels, level);
        if (levelMatch.distance === 0) score += 4;
        else if (levelMatch.distance === 1) score += 2;
        if (levelMatch.distance <= 1) why.push(levelMatch.value);

        if (format === 'physical') why.push('Physical book');
        if (format === 'digital') why.push('eBook');

        return score > 0 ? { book, score, why, order } : null;
      })
      .filter(Boolean)
      .sort((a, b) => b.score - a.score || Number(b.book.available) - Number(a.book.available) || a.order - b.order)
      .slice(0, Number(this.dataset.resultsCount) || 3);
  }

  #renderResults() {
    const picks = this.#recommend();
    const list = this.querySelector('[data-picks]');
    const empty = /** @type {HTMLElement} */ (this.querySelector('[data-empty]'));
    const { format } = this.#answers;

    list.innerHTML = picks
      .map(({ book, why }, index) => {
        const variant =
          (format === 'digital' && book.digitalVariant) || (format === 'physical' && book.physicalVariant) || book.variant;
        const url = variant && format !== 'any' ? `${book.url}?variant=${variant}` : book.url;
        const image = book.image
          ? `<img src="${escape(book.image)}" alt="${escape(book.alt)}" loading="lazy">`
          : `<span class="book-finder__pick-cover">${escape(book.title.split(' - ')[0])}</span>`;
        const price = `${book.priceVaries ? '<small>From</small>' : ''}${escape(book.price)}${
          book.compareAt ? ` <s>${escape(book.compareAt)}</s>` : ''
        }`;
        const action = book.available
          ? `<button type="button" class="brand-button brand-button--purchase" data-add data-variant-id="${escape(variant)}" data-product-id="${escape(book.id)}"><span>Add to cart</span></button>`
          : `<span class="brand-button brand-button--secondary" aria-disabled="true"><span>Sold out</span></span>`;

        return `
          <li class="book-finder__pick book-finder__pick--${escape(book.tint)}" style="--i: ${index};">
            ${index === 0 ? '<span class="book-finder__badge">★ Best match</span>' : ''}
            <a class="book-finder__pick-media" href="${escape(url)}" tabindex="-1" aria-hidden="true">${image}</a>
            <div class="book-finder__pick-body">
              <ul class="book-finder__pick-why" role="list">${why.map((w) => `<li>${escape(w)}</li>`).join('')}</ul>
              <p class="book-finder__pick-title"><a href="${escape(url)}">${escape(book.title)}</a></p>
              ${book.author ? `<p class="book-finder__pick-author">by ${escape(book.author)}</p>` : ''}
              <p class="book-finder__pick-price">${price}</p>
            </div>
            <div class="book-finder__pick-actions">
              ${action}
              <a class="book-finder__pick-link" href="${escape(url)}">View details <span aria-hidden="true">→</span></a>
            </div>
          </li>`;
      })
      .join('');

    empty.hidden = picks.length > 0;
    list.scrollLeft = 0;
    requestAnimationFrame(this.#updateArrows);
  }

  /* ---------- Results track ---------- */

  /** @param {number} direction -1 or 1: one card back or forward. */
  #slide(direction) {
    const track = this.#track;
    const card = track?.querySelector('.book-finder__pick');
    if (!track || !card) return;
    const gap = parseFloat(getComputedStyle(track).columnGap) || 0;
    track.scrollBy({ left: direction * (card.getBoundingClientRect().width + gap), behavior: 'smooth' });
  }

  #updateArrows = () => {
    const track = this.#track;
    const arrows = /** @type {HTMLElement|null} */ (this.querySelector('[data-arrows]'));
    if (!track || !arrows) return;
    const max = track.scrollWidth - track.clientWidth;
    arrows.hidden = max <= 2;
    /** @type {HTMLButtonElement} */ (arrows.querySelector('[data-prev]')).disabled = track.scrollLeft <= 2;
    /** @type {HTMLButtonElement} */ (arrows.querySelector('[data-next]')).disabled = track.scrollLeft >= max - 2;
  };

  /** Touch and pen scroll natively; the mouse drags. */
  #onPointerDown = (event) => {
    if (event.pointerType !== 'mouse' || event.button !== 0) return;
    if (/** @type {HTMLElement} */ (event.target).closest('button')) return;
    const track = this.#track;
    if (!track || track.scrollWidth <= track.clientWidth) return;
    this.#drag = { active: true, startX: event.clientX, scrollLeft: track.scrollLeft, moved: false };
  };

  #onPointerMove = (event) => {
    if (!this.#drag.active) return;
    const track = this.#track;
    const delta = event.clientX - this.#drag.startX;
    if (!this.#drag.moved && Math.abs(delta) < 5) return;
    this.#drag.moved = true;
    track.classList.add('is-dragging');
    track.scrollLeft = this.#drag.scrollLeft - delta;
  };

  #onPointerUp = () => {
    if (!this.#drag.active) return;
    this.#drag.active = false;
    const track = this.#track;
    if (!this.#drag.moved) return;

    // Snap to the nearest card once released.
    const card = track.querySelector('.book-finder__pick');
    const gap = parseFloat(getComputedStyle(track).columnGap) || 0;
    const step = card ? card.getBoundingClientRect().width + gap : track.clientWidth;
    const left = Math.round(track.scrollLeft / step) * step;
    track.classList.remove('is-dragging');
    track.scrollTo({ left, behavior: 'smooth' });

    // The click that follows this pointerup is swallowed in #onClick, then reset.
    setTimeout(() => {
      this.#drag.moved = false;
    });
  };

  /** @param {HTMLButtonElement} button */
  async #add(button) {
    const label = button.querySelector('span');
    const original = label?.textContent;
    button.classList.add('is-loading');
    button.closest('.book-finder__pick')?.querySelector('.book-finder__pick-error')?.remove();

    const { ok, message } = await addToCart({
      source: button,
      variantId: button.dataset.variantId,
      productId: button.dataset.productId,
    });

    button.classList.remove('is-loading');
    if (ok) {
      if (label) label.textContent = 'Added ✓';
      setTimeout(() => {
        if (label) label.textContent = original;
      }, 2000);
    } else {
      button.insertAdjacentHTML('afterend', `<p class="book-finder__pick-error" role="alert">${escape(message)}</p>`);
    }
  }
}

if (!customElements.get('book-finder')) {
  customElements.define('book-finder', BookFinder);
}
