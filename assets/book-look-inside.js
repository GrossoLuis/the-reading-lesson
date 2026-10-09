/**
 * Look inside: the row of sample pages and the full-screen viewer.
 *
 * Row: the round arrows scroll it by one page and dim at either end.
 * Viewer: a <dialog> holding a native scroll-snap row, so swipe works on touch screens;
 * arrows, keyboard (← →, Esc) and thumbnails move it, and the counter and thumbnails
 * follow the page in view. Its images carry data-src and load when it first opens:
 * lazy-loading never fires inside a closed dialog. Markup lives in
 * sections/book-look-inside.liquid.
 */
class BookLookInside extends HTMLElement {
  #index = 0;
  #frame = 0;
  #trackFrame = 0;

  connectedCallback() {
    this.track = this.querySelector('[data-track]');
    this.trackArrows = [...this.querySelectorAll('[data-track-step]')];
    this.viewer = this.querySelector('[data-viewer]');
    this.slides = this.querySelector('[data-viewer-slides]');
    this.current = this.querySelector('[data-viewer-current]');
    this.thumbs = [...this.querySelectorAll('[data-viewer-thumb]')];
    this.prev = this.querySelector('[data-viewer-step="-1"]');
    this.next = this.querySelector('[data-viewer-step="1"]');

    // Row
    this.trackArrows.forEach((arrow) =>
      arrow.addEventListener('click', () => this.#stepTrack(Number(arrow.dataset.trackStep)))
    );
    this.track?.addEventListener('scroll', this.#onTrackScroll, { passive: true });
    window.addEventListener('resize', this.#onTrackScroll);
    this.#updateTrackArrows();

    // Viewer
    if (!this.viewer || !this.slides) return;
    this.querySelectorAll('[data-viewer-open]').forEach((trigger) =>
      trigger.addEventListener('click', () => this.open(Number(trigger.dataset.index) || 0))
    );
    this.querySelector('[data-viewer-close]')?.addEventListener('click', () => this.viewer.close());
    this.querySelectorAll('[data-viewer-step]').forEach((button) =>
      button.addEventListener('click', () => this.goTo(this.#index + Number(button.dataset.viewerStep)))
    );
    this.thumbs.forEach((thumb) => thumb.addEventListener('click', () => this.goTo(Number(thumb.dataset.index))));
    this.viewer.addEventListener('keydown', this.#onKeydown);
    this.viewer.addEventListener('click', (event) => {
      if (event.target === this.viewer) this.viewer.close();
    });
    this.slides.addEventListener('scroll', this.#onScroll, { passive: true });
  }

  disconnectedCallback() {
    window.removeEventListener('resize', this.#onTrackScroll);
    cancelAnimationFrame(this.#frame);
    cancelAnimationFrame(this.#trackFrame);
  }

  get #smooth() {
    return !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  /* ---------------------------------------------------------------------------
     Row
     --------------------------------------------------------------------------- */

  #stepTrack(step) {
    if (!this.track) return;
    const item = this.track.querySelector('[data-track-item]');
    const gap = parseFloat(getComputedStyle(this.track).columnGap) || 0;
    const distance = item ? item.getBoundingClientRect().width + gap : this.track.clientWidth * 0.8;
    this.track.scrollBy({ left: step * distance, behavior: this.#smooth ? 'smooth' : 'instant' });
  }

  #onTrackScroll = () => {
    cancelAnimationFrame(this.#trackFrame);
    this.#trackFrame = requestAnimationFrame(() => this.#updateTrackArrows());
  };

  #updateTrackArrows() {
    if (!this.track || !this.trackArrows.length) return;
    const max = this.track.scrollWidth - this.track.clientWidth - 2;
    // Every page fits: no arrows at all.
    this.trackArrows[0].parentElement.hidden = max <= 0;
    this.trackArrows.forEach((arrow) => {
      arrow.disabled = Number(arrow.dataset.trackStep) < 0 ? this.track.scrollLeft <= 2 : this.track.scrollLeft >= max;
    });
  }

  /* ---------------------------------------------------------------------------
     Viewer
     --------------------------------------------------------------------------- */

  get #count() {
    return this.slides.children.length;
  }

  /** @param {number} index */
  open(index) {
    this.viewer.querySelectorAll('img[data-src]').forEach((image) => {
      image.src = image.dataset.src;
      image.removeAttribute('data-src');
    });
    this.viewer.showModal();
    this.goTo(index, 'instant');
  }

  /**
   * @param {number} index
   * @param {ScrollBehavior} [behavior]
   */
  goTo(index, behavior) {
    const target = Math.min(Math.max(index, 0), this.#count - 1);
    this.slides.scrollTo({
      left: target * this.slides.clientWidth,
      behavior: behavior ?? (this.#smooth ? 'smooth' : 'instant'),
    });
    this.#setActive(target);
  }

  #onScroll = () => {
    cancelAnimationFrame(this.#frame);
    this.#frame = requestAnimationFrame(() => {
      const index = Math.round(this.slides.scrollLeft / this.slides.clientWidth);
      if (index !== this.#index) this.#setActive(index);
    });
  };

  #onKeydown = (event) => {
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      this.goTo(this.#index + 1);
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      this.goTo(this.#index - 1);
    }
  };

  #setActive(index) {
    this.#index = index;
    if (this.current) this.current.textContent = String(index + 1);
    if (this.prev) this.prev.disabled = index === 0;
    if (this.next) this.next.disabled = index === this.#count - 1;

    this.thumbs.forEach((thumb, i) => {
      if (i === index) {
        thumb.setAttribute('aria-current', 'true');
        thumb.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      } else {
        thumb.removeAttribute('aria-current');
      }
    });
  }
}

if (!customElements.get('book-look-inside')) {
  customElements.define('book-look-inside', BookLookInside);
}
