/**
 * Carousel CTA (sections/carousel-cta.liquid): a scroll-snap photo track.
 *
 * - Arrows move one card at a time and switch off at either end.
 * - The progress bar works like a scrollbar and takes the tag colour of the card in view;
 *   the counter shows which card that is.
 * - Mouse drag scrolls the track and lands on the nearest card (touch keeps the native
 *   swipe). A drag never fires the click on a linked card.
 * - Optional autoplay (data-autoplay, ms): pauses while hovered, focused, off screen or
 *   when the tab is hidden; the toggle button stops it for good.
 * - The header and cards rise in the first time the section scrolls into view.
 * - In the theme editor, selecting a photo block scrolls to it.
 */

const REDUCED_MOTION = window.matchMedia('(prefers-reduced-motion: reduce)');
const DRAG_THRESHOLD = 6;
const FLICK_DISTANCE = 60;

const pad = (n) => String(n).padStart(2, '0');

class CarouselCta extends HTMLElement {
  #abort = new AbortController();
  #track = null;
  #slides = [];
  #prev = null;
  #next = null;
  #thumb = null;
  #current = null;
  #toggle = null;
  #frame = 0;
  #index = 0;
  #observers = [];

  #delay = 0;
  #timer = 0;
  #stopped = false;
  #hovered = false;
  #focused = false;
  #onScreen = false;

  connectedCallback() {
    this.#track = this.querySelector('[data-track]');
    if (!this.#track) return;

    this.#slides = [...this.#track.querySelectorAll('[data-slide]')];
    this.#prev = this.querySelector('[data-prev]');
    this.#next = this.querySelector('[data-next]');
    this.#thumb = this.querySelector('[data-thumb]');
    this.#current = this.querySelector('[data-current]');
    this.#toggle = this.querySelector('[data-toggle]');

    const { signal } = this.#abort;

    this.#prev?.addEventListener('click', () => this.#userStep(-1), { signal });
    this.#next?.addEventListener('click', () => this.#userStep(1), { signal });
    this.#track.addEventListener('scroll', () => this.#requestUpdate(), { passive: true, signal });
    this.#track.addEventListener('keydown', (event) => this.#onKeydown(event), { signal });
    this.#track.addEventListener('dragstart', (event) => event.preventDefault(), { signal });
    window.addEventListener('resize', () => this.#requestUpdate(), { passive: true, signal });

    const resize = new ResizeObserver(() => this.#requestUpdate());
    resize.observe(this.#track);
    this.#observers.push(resize);

    this.#setupDrag(signal);
    this.#setupReveal();
    this.#setupAutoplay(signal);
    this.#setupEditor(signal);
    this.#update();
  }

  disconnectedCallback() {
    this.#abort.abort();
    this.#abort = new AbortController();
    this.#observers.forEach((observer) => observer.disconnect());
    this.#observers = [];
    cancelAnimationFrame(this.#frame);
    clearTimeout(this.#timer);
  }

  /* ---------- Position ---------- */

  get #behavior() {
    return REDUCED_MOTION.matches ? 'auto' : 'smooth';
  }

  get #maxScroll() {
    return Math.max(0, this.#track.scrollWidth - this.#track.clientWidth);
  }

  /** Scroll position at which `slide` sits at the start of the track. */
  #offsetOf(slide) {
    return Math.min(slide.offsetLeft - this.#slides[0].offsetLeft, this.#maxScroll);
  }

  #nearestIndex() {
    const left = this.#track.scrollLeft;
    let nearest = 0;
    let distance = Infinity;
    this.#slides.forEach((slide, i) => {
      const d = Math.abs(this.#offsetOf(slide) - left);
      if (d < distance) {
        distance = d;
        nearest = i;
      }
    });
    return nearest;
  }

  #goTo(index, behavior = this.#behavior) {
    const clamped = Math.max(0, Math.min(index, this.#slides.length - 1));
    this.#track.scrollTo({ left: this.#offsetOf(this.#slides[clamped]), behavior });
  }

  #step(direction) {
    const atEnd = this.#track.scrollLeft >= this.#maxScroll - 2;
    if (direction > 0 && atEnd) {
      this.#goTo(0);
      return;
    }
    this.#goTo(this.#nearestIndex() + direction);
  }

  #userStep(direction) {
    this.#goTo(this.#nearestIndex() + direction);
    this.#restartAutoplay();
  }

  #onKeydown(event) {
    if (event.target !== this.#track) return;
    if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
      event.preventDefault();
      this.#userStep(event.key === 'ArrowRight' ? 1 : -1);
    }
  }

  /* ---------- Progress, counter and arrows ---------- */

  #requestUpdate() {
    cancelAnimationFrame(this.#frame);
    this.#frame = requestAnimationFrame(() => this.#update());
  }

  #update() {
    const { scrollLeft, scrollWidth, clientWidth } = this.#track;
    const max = this.#maxScroll;
    const isStatic = max <= 2;
    this.classList.toggle('is-static', isStatic);

    const atStart = scrollLeft <= 2;
    const atEnd = scrollLeft >= max - 2;
    if (this.#prev) this.#prev.disabled = isStatic || atStart;
    if (this.#next) this.#next.disabled = isStatic || atEnd;

    // At the far end the last card is in view even though it can't reach the start.
    this.#index = atEnd && !isStatic ? this.#slides.length - 1 : this.#nearestIndex();
    if (this.#current) this.#current.textContent = pad(this.#index + 1);

    if (this.#thumb) {
      const size = Math.min(1, clientWidth / scrollWidth);
      const progress = max > 0 ? scrollLeft / max : 0;
      const slide = this.#slides[this.#index];
      const color = getComputedStyle(slide).getPropertyValue('--cc-accent').trim();
      this.#thumb.style.setProperty('--cc-thumb-size', size.toFixed(4));
      // translateX percentages are of the thumb itself, so scale the free space by it.
      this.#thumb.style.setProperty('--cc-thumb-offset', ((progress * (1 - size)) / size).toFixed(4));
      if (color) this.#thumb.style.setProperty('--cc-thumb-color', color);
    }
  }

  /* ---------- Mouse drag ---------- */

  #setupDrag(signal) {
    let drag = null;

    const onMove = (event) => {
      if (!drag) return;
      const delta = event.clientX - drag.x;
      if (!drag.moved && Math.abs(delta) < DRAG_THRESHOLD) return;
      if (!drag.moved) {
        drag.moved = true;
        this.#track.classList.add('is-dragging');
        this.#track.setPointerCapture(event.pointerId);
      }
      this.#track.scrollLeft = drag.left - delta;
    };

    const onUp = (event) => {
      if (!drag) return;
      const { moved, x, index } = drag;
      drag = null;
      if (!moved) return;

      this.#track.classList.remove('is-dragging');
      if (this.#track.hasPointerCapture(event.pointerId)) {
        this.#track.releasePointerCapture(event.pointerId);
      }

      // A short, quick flick still moves one card.
      const delta = x - event.clientX;
      let target = this.#nearestIndex();
      if (target === index && Math.abs(delta) > FLICK_DISTANCE) target += Math.sign(delta);
      this.#goTo(target);
      this.#restartAutoplay();

      // Swallow the click that follows the drag, so a linked card isn't opened.
      const swallow = (click) => {
        click.preventDefault();
        click.stopPropagation();
      };
      this.#track.addEventListener('click', swallow, { capture: true, once: true, signal });
      setTimeout(() => this.#track.removeEventListener('click', swallow, { capture: true }), 0);
    };

    this.#track.addEventListener(
      'pointerdown',
      (event) => {
        if (event.pointerType !== 'mouse' || event.button !== 0) return;
        drag = {
          x: event.clientX,
          left: this.#track.scrollLeft,
          index: this.#nearestIndex(),
          moved: false,
        };
      },
      { signal }
    );
    this.#track.addEventListener('pointermove', onMove, { signal });
    this.#track.addEventListener('pointerup', onUp, { signal });
    this.#track.addEventListener('pointercancel', onUp, { signal });
    this.#track.addEventListener('lostpointercapture', onUp, { signal });
  }

  /* ---------- Reveal ---------- */

  #setupReveal() {
    if (REDUCED_MOTION.matches || window.Shopify?.designMode) return;
    // Only animate what the visitor hasn't seen yet; never hide content already on screen.
    if (this.getBoundingClientRect().top < window.innerHeight * 0.9) return;

    this.classList.add('is-hidden');
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        observer.disconnect();
        this.classList.add('is-revealing');
        requestAnimationFrame(() => this.classList.remove('is-hidden'));
        setTimeout(() => this.classList.remove('is-revealing'), 1800);
      },
      { threshold: 0.15 }
    );
    observer.observe(this);
    this.#observers.push(observer);
  }

  /* ---------- Autoplay ---------- */

  #setupAutoplay(signal) {
    this.#delay = Number(this.dataset.autoplay) || 0;
    if (!this.#delay || REDUCED_MOTION.matches || window.Shopify?.designMode) {
      if (this.#toggle) this.#toggle.hidden = true;
      return;
    }

    this.addEventListener('pointerenter', () => this.#setFlag('hovered', true), { signal });
    this.addEventListener('pointerleave', () => this.#setFlag('hovered', false), { signal });
    this.addEventListener('focusin', () => this.#setFlag('focused', true), { signal });
    this.addEventListener(
      'focusout',
      (event) => {
        if (!this.contains(event.relatedTarget)) this.#setFlag('focused', false);
      },
      { signal }
    );
    document.addEventListener('visibilitychange', () => this.#restartAutoplay(), { signal });

    this.#toggle?.addEventListener(
      'click',
      () => {
        this.#stopped = !this.#stopped;
        const label = this.#stopped ? this.#toggle.dataset.labelPlay : this.#toggle.dataset.labelPause;
        this.#toggle.setAttribute('aria-pressed', String(this.#stopped));
        this.#toggle.setAttribute('aria-label', label);
        this.#restartAutoplay();
      },
      { signal }
    );

    const observer = new IntersectionObserver(
      ([entry]) => {
        this.#onScreen = Boolean(entry?.isIntersecting);
        this.#restartAutoplay();
      },
      { threshold: 0.3 }
    );
    observer.observe(this);
    this.#observers.push(observer);
  }

  #setFlag(name, value) {
    if (name === 'hovered') this.#hovered = value;
    if (name === 'focused') this.#focused = value;
    this.#restartAutoplay();
  }

  #restartAutoplay() {
    clearTimeout(this.#timer);
    const running =
      this.#delay > 0 &&
      !this.#stopped &&
      !this.#hovered &&
      !this.#focused &&
      this.#onScreen &&
      !document.hidden &&
      !this.classList.contains('is-static');
    if (!running) return;

    this.#timer = setTimeout(() => {
      this.#step(1);
      this.#restartAutoplay();
    }, this.#delay);
  }

  /* ---------- Theme editor ---------- */

  #setupEditor(signal) {
    if (!window.Shopify?.designMode) return;
    document.addEventListener(
      'shopify:block:select',
      (event) => {
        const slide = event.target instanceof Element ? event.target.closest('[data-slide]') : null;
        const index = this.#slides.indexOf(slide);
        if (index !== -1) this.#goTo(index);
      },
      { signal }
    );
  }
}

if (!customElements.get('carousel-cta')) {
  customElements.define('carousel-cta', CarouselCta);
}
