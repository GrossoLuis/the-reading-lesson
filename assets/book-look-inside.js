/**
 * Look inside: opens the sample pages in a full-screen <dialog>.
 *
 * The viewer is a native scroll-snap row, so swipe works on touch screens without extra
 * code; arrows, keyboard (← →, Esc) and thumbnails scroll it to a page, and the counter
 * and thumbnails follow whatever page is in view. Markup lives in
 * sections/book-look-inside.liquid.
 */
class BookLookInside extends HTMLElement {
  #index = 0;
  #frame = 0;

  connectedCallback() {
    this.viewer = this.querySelector('[data-viewer]');
    this.slides = this.querySelector('[data-viewer-slides]');
    this.current = this.querySelector('[data-viewer-current]');
    this.thumbs = [...this.querySelectorAll('[data-viewer-thumb]')];
    this.prev = this.querySelector('[data-viewer-step="-1"]');
    this.next = this.querySelector('[data-viewer-step="1"]');
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
    this.slides.addEventListener('scroll', this.#onScroll, { passive: true });
  }

  disconnectedCallback() {
    cancelAnimationFrame(this.#frame);
  }

  get #count() {
    return this.slides.children.length;
  }

  /** @param {number} index */
  open(index) {
    this.viewer.showModal();
    this.goTo(index, 'instant');
  }

  /**
   * @param {number} index
   * @param {ScrollBehavior} [behavior]
   */
  goTo(index, behavior) {
    const target = Math.min(Math.max(index, 0), this.#count - 1);
    const smooth = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.slides.scrollTo({
      left: target * this.slides.clientWidth,
      behavior: behavior ?? (smooth ? 'smooth' : 'instant'),
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
