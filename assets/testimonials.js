/**
 * Featured reviews on the ink card (sections/testimonials.liquid).
 *
 * - Shows one review at a time; the others are stacked in the same spot, hidden, so
 *   the card keeps the height of the longest one and never jumps.
 * - Every data-interval ms the next review shows. A timer keeps the time left across
 *   pauses, and the active dot's fill (CSS) pauses with it, so both stay in step. With
 *   no data-interval, or with reduced motion, the reviews only change from the dots.
 * - Pauses while hovered or focused, when off screen and when the tab is hidden; the
 *   pause button stops it until pressed again.
 * - In the theme editor, selecting a featured review shows it and holds it there.
 */

const REDUCED_MOTION = window.matchMedia('(prefers-reduced-motion: reduce)');

class TestimonialsFeature extends HTMLElement {
  #abort = new AbortController();
  #slides = [];
  #dots = [];
  #toggle = null;
  #observer = null;
  #index = 0;
  #autoplay = false;
  #stopped = false;
  #holds = new Set();
  #interval = 0;
  #timer = 0;
  #remaining = 0;
  #startedAt = 0;

  connectedCallback() {
    this.#slides = [...this.querySelectorAll('[data-feature-slide]')];
    this.#dots = [...this.querySelectorAll('[data-feature-dot]')];
    this.#toggle = this.querySelector('[data-feature-toggle]');
    if (this.#slides.length < 2) return;

    const { signal } = this.#abort;
    this.#interval = Number(this.dataset.interval) || 0;
    this.#autoplay = this.#interval > 0 && !REDUCED_MOTION.matches;
    this.style.setProperty('--feature-interval', `${this.#interval}ms`);
    this.classList.toggle('is-autoplay', this.#autoplay);
    if (this.#toggle) this.#toggle.hidden = !this.#autoplay;

    this.#dots.forEach((dot, i) => {
      dot.addEventListener('click', () => this.#show(i), { signal });
    });

    this.#toggle?.addEventListener(
      'click',
      () => {
        this.#stopped = !this.#stopped;
        this.#toggle.setAttribute('aria-pressed', String(this.#stopped));
        this.#toggle.setAttribute(
          'aria-label',
          this.#stopped ? this.#toggle.dataset.labelPlay : this.#toggle.dataset.labelPause
        );
        this.#sync();
      },
      { signal }
    );

    this.addEventListener('pointerenter', () => this.#hold('hover', true), { signal });
    this.addEventListener('pointerleave', () => this.#hold('hover', false), { signal });
    this.addEventListener('focusin', () => this.#hold('focus', true), { signal });
    this.addEventListener(
      'focusout',
      (event) => {
        if (!this.contains(event.relatedTarget)) this.#hold('focus', false);
      },
      { signal }
    );
    document.addEventListener('visibilitychange', () => this.#hold('hidden', document.hidden), { signal });

    this.#observer = new IntersectionObserver(([entry]) => this.#hold('offscreen', !entry?.isIntersecting), {
      threshold: 0.25,
    });
    this.#observer.observe(this);

    if (window.Shopify?.designMode) {
      document.addEventListener(
        'shopify:block:select',
        (event) => {
          const index = this.#slides.indexOf(event.target);
          if (index === -1) return;
          this.#show(index);
          this.#hold('editor', true);
        },
        { signal }
      );
      document.addEventListener(
        'shopify:block:deselect',
        (event) => {
          if (this.#slides.includes(event.target)) this.#hold('editor', false);
        },
        { signal }
      );
    }

    this.#show(0);
  }

  disconnectedCallback() {
    this.#abort.abort();
    this.#abort = new AbortController();
    this.#observer?.disconnect();
    clearTimeout(this.#timer);
  }

  #hold(reason, on) {
    if (on) this.#holds.add(reason);
    else this.#holds.delete(reason);
    this.#sync();
  }

  get #paused() {
    return this.#stopped || this.#holds.size > 0;
  }

  /** Pauses or resumes the timer and the dot fill together. */
  #sync() {
    this.toggleAttribute('data-paused', this.#paused);
    if (!this.#autoplay) return;

    if (this.#paused) {
      if (this.#timer) {
        clearTimeout(this.#timer);
        this.#timer = 0;
        this.#remaining -= performance.now() - this.#startedAt;
      }
    } else if (!this.#timer) {
      this.#startedAt = performance.now();
      this.#timer = setTimeout(() => {
        this.#timer = 0;
        this.#show((this.#index + 1) % this.#slides.length);
      }, Math.max(0, this.#remaining));
    }
  }

  #show(index) {
    this.#index = index;
    this.#slides.forEach((slide, i) => {
      const active = i === index;
      slide.classList.toggle('is-active', active);
      slide.setAttribute('aria-hidden', String(!active));
      slide.inert = !active;
    });
    this.#dots.forEach((dot, i) => {
      const active = i === index;
      dot.classList.remove('is-active');
      if (active) {
        // Restart the fill from zero, even when the same dot is clicked again.
        void dot.offsetWidth;
        dot.classList.add('is-active');
        dot.setAttribute('aria-current', 'true');
      } else {
        dot.removeAttribute('aria-current');
      }
    });

    // A new review always gets the full interval.
    clearTimeout(this.#timer);
    this.#timer = 0;
    this.#remaining = this.#interval;
    this.#sync();
  }
}

if (!customElements.get('testimonials-feature')) {
  customElements.define('testimonials-feature', TestimonialsFeature);
}
