import { addToCart } from '@theme/cart-add';
import { formatMoney } from '@theme/money-formatting';
import { getScrollContainer } from '@theme/scroll-container';

/**
 * Product page: scroll-driven sticky gallery, variant pills, quantity, add to cart
 * and zoom. Markup lives in sections/product.liquid.
 *
 * Scrolling: Horizon scrolls `.page-wrapper` on desktop and the document on mobile, so
 * scroll events are caught in the capture phase on document (that sees both) and the
 * page is moved through getScrollContainer().
 *
 * Gallery, desktop (≥990px): the gallery column is taller than the viewport and its
 * frame is sticky. Scroll progress through the column picks the active image, so
 * the images advance as the page scrolls. Thumbnails and variant changes scroll the
 * page to the position of their image, which keeps one source of truth.
 * Gallery, below 990px: a native scroll-snap carousel; the dots follow it.
 *
 * Add to cart goes through @theme/cart-add, which dispatches CartLinesUpdateEvent
 * like Horizon's product form, so the cart drawer and the header count react to it.
 */
class ProductPage extends HTMLElement {
  #desktop = window.matchMedia('(min-width: 990px)');
  #index = 0;
  #pinUntil = 0;
  #frame = 0;
  #resizeObserver = null;
  #variants = [];
  #addedTimer = 0;
  #zoomIndex = 0;

  connectedCallback() {
    this.gallery = this.querySelector('[data-gallery]');
    this.sticky = this.querySelector('.pdp__gallery-sticky');
    this.slides = [...this.querySelectorAll('[data-slide]')];
    this.slideList = this.querySelector('[data-slides]');
    this.thumbs = [...this.querySelectorAll('[data-thumb]')];
    this.thumbList = this.querySelector('[data-thumbs]');
    this.dots = [...this.querySelectorAll('.pdp__dot')];
    this.counter = this.querySelector('[data-counter-current]');
    this.progress = this.querySelector('[data-progress]');
    this.info = this.querySelector('[data-info]');
    this.form = this.querySelector('form[action*="/cart/add"]');

    try {
      this.#variants = JSON.parse(this.querySelector('[data-variants]')?.textContent || '[]');
    } catch {
      this.#variants = [];
    }

    this.#index = Number(this.gallery?.dataset.initialIndex) || 0;

    // Gallery
    this.thumbs.forEach((thumb) =>
      thumb.addEventListener('click', () => this.goTo(Number(thumb.dataset.index), { scroll: true }))
    );
    document.addEventListener('scroll', this.#onScroll, { passive: true, capture: true });
    window.addEventListener('resize', this.#onResize);
    this.#desktop.addEventListener('change', this.#onResize);
    this.slideList?.addEventListener('scroll', this.#onCarouselScroll, { passive: true });

    // Sticky info adapts to its own height.
    this.#resizeObserver = new ResizeObserver(this.#updateInfoTop);
    if (this.info) this.#resizeObserver.observe(this.info);

    // Form
    this.form?.addEventListener('change', this.#onOptionChange);
    this.form?.addEventListener('submit', this.#onSubmit);
    this.querySelectorAll('[data-qty]').forEach((button) =>
      button.addEventListener('click', () => this.#stepQuantity(Number(button.dataset.qty)))
    );

    // Zoom
    this.zoom = this.querySelector('[data-zoom]');
    this.querySelectorAll('[data-zoom-open]').forEach((trigger) =>
      trigger.addEventListener('click', () => this.#openZoom(Number(trigger.dataset.index)))
    );
    this.zoom?.querySelector('[data-zoom-close]')?.addEventListener('click', () => this.zoom.close());
    this.zoom?.querySelectorAll('[data-zoom-step]').forEach((button) =>
      button.addEventListener('click', () => this.#stepZoom(Number(button.dataset.zoomStep)))
    );
    this.zoom?.addEventListener('click', (event) => {
      if (event.target === this.zoom) this.zoom.close();
    });
    this.zoom?.addEventListener('keydown', (event) => {
      if (event.key === 'ArrowRight') this.#stepZoom(1);
      if (event.key === 'ArrowLeft') this.#stepZoom(-1);
    });

    this.#onResize();
  }

  disconnectedCallback() {
    document.removeEventListener('scroll', this.#onScroll, { capture: true });
    window.removeEventListener('resize', this.#onResize);
    this.#desktop.removeEventListener('change', this.#onResize);
    this.#resizeObserver?.disconnect();
    cancelAnimationFrame(this.#frame);
  }

  /* ---------------------------------------------------------------------------
     Gallery
     --------------------------------------------------------------------------- */

  get #count() {
    return this.slides.length;
  }

  /** Scroll distance the sticky frame travels inside the gallery column. */
  #travel() {
    if (!this.gallery || !this.sticky) return 0;
    return this.gallery.getBoundingClientRect().height - this.sticky.offsetHeight;
  }

  #stickyTop() {
    return this.sticky ? parseFloat(getComputedStyle(this.sticky).top) || 0 : 0;
  }

  #onScroll = () => {
    cancelAnimationFrame(this.#frame);
    this.#frame = requestAnimationFrame(() => {
      if (!this.#desktop.matches || this.#count < 2) return;
      if (performance.now() < this.#pinUntil) return;

      const travel = this.#travel();
      if (travel <= 0) return;

      const progress = Math.min(Math.max((this.#stickyTop() - this.gallery.getBoundingClientRect().top) / travel, 0), 1);
      const index = Math.min(this.#count - 1, Math.floor(progress * this.#count));
      if (index !== this.#index) this.#setActive(index);
    });
  };

  #onResize = () => {
    this.#updateInfoTop();
    if (this.#desktop.matches) {
      this.#onScroll();
    } else {
      this.#scrollCarousel(this.#index, 'instant');
    }
  };

  #onCarouselScroll = () => {
    if (this.#desktop.matches || !this.slideList) return;
    const index = Math.round(this.slideList.scrollLeft / this.slideList.clientWidth);
    if (index !== this.#index && index >= 0 && index < this.#count) this.#setActive(index);
  };

  /**
   * Shows an image. With `scroll`, moves the page (desktop) or the carousel (mobile)
   * to it, so scrolling and the active image stay in step.
   * @param {number} index
   * @param {{ scroll?: boolean }} [options]
   */
  goTo(index, { scroll = false } = {}) {
    if (index < 0 || index >= this.#count) return;
    this.#setActive(index);
    if (!scroll) return;

    if (!this.#desktop.matches) {
      this.#scrollCarousel(index, 'smooth');
      return;
    }

    const travel = this.#travel();
    if (travel <= 0) return;

    // Middle of the image's scroll band.
    const container = getScrollContainer();
    const target =
      container.scrollTop +
      this.gallery.getBoundingClientRect().top -
      this.#stickyTop() +
      ((index + 0.5) / this.#count) * travel;

    const smooth = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    // Hold the chosen image while the smooth scroll passes the others.
    this.#pinUntil = performance.now() + (smooth ? 900 : 0);
    container.scrollTo({ top: target, behavior: smooth ? 'smooth' : 'instant' });
  }

  #scrollCarousel(index, behavior) {
    if (!this.slideList) return;
    this.slideList.scrollTo({ left: index * this.slideList.clientWidth, behavior });
  }

  #setActive(index) {
    this.#index = index;

    this.slides.forEach((slide, i) => {
      const active = i === index;
      slide.classList.toggle('is-active', active);
      // The carousel shows every slide side by side, so only hide them on desktop.
      if (this.#desktop.matches) {
        slide.toggleAttribute('aria-hidden', !active);
        slide.toggleAttribute('inert', !active);
      } else {
        slide.removeAttribute('aria-hidden');
        slide.removeAttribute('inert');
      }
      if (!active) slide.querySelector('video')?.pause();
    });

    this.thumbs.forEach((thumb, i) => {
      if (i === index) {
        thumb.setAttribute('aria-current', 'true');
        this.#revealThumb(thumb);
      } else {
        thumb.removeAttribute('aria-current');
      }
    });

    this.dots.forEach((dot, i) => dot.classList.toggle('is-active', i === index));
    if (this.counter) this.counter.textContent = String(index + 1).padStart(2, '0');
    this.progress?.style.setProperty('--progress', `${((index + 1) / this.#count) * 100}%`);
  }

  /** Keeps the active thumbnail visible inside the rail without moving the page. */
  #revealThumb(thumb) {
    const list = this.thumbList;
    if (!list || list.scrollHeight <= list.clientHeight) return;
    const item = thumb.parentElement;
    const top = item.offsetTop - list.offsetTop;
    const bottom = top + item.offsetHeight;
    if (top < list.scrollTop) list.scrollTo({ top: top - 8, behavior: 'smooth' });
    else if (bottom > list.scrollTop + list.clientHeight)
      list.scrollTo({ top: bottom - list.clientHeight + 8, behavior: 'smooth' });
  }

  /**
   * The info column sticks at the header offset when it fits the viewport. When it is
   * taller, it sticks by its bottom edge instead, so all of it can still be read.
   */
  #updateInfoTop = () => {
    if (!this.info) return;
    const top = this.#stickyTop() || 24;
    const fitTop = window.innerHeight - this.info.offsetHeight - 24;
    this.style.setProperty('--pdp-info-top', `${Math.min(top, fitTop)}px`);
  };

  /* ---------------------------------------------------------------------------
     Variants
     --------------------------------------------------------------------------- */

  #selectedOptions() {
    return [...this.querySelectorAll('[data-option]')].map(
      (fieldset) => fieldset.querySelector('[data-option-input]:checked')?.value ?? null
    );
  }

  #onOptionChange = (event) => {
    if (!event.target.matches('[data-option-input]')) return;

    const selected = this.#selectedOptions();
    const variant = this.#variants.find((v) => v.options.every((value, i) => value === selected[i]));

    this.querySelectorAll('[data-option]').forEach((fieldset, i) => {
      const label = fieldset.querySelector('[data-option-selected]');
      if (label) label.textContent = selected[i] ?? '';
    });

    this.#updateAvailability(selected);
    this.#renderVariant(variant);

    if (variant) {
      const url = new URL(window.location.href);
      url.searchParams.set('variant', variant.id);
      window.history.replaceState({}, '', url.toString());

      if (variant.featured_media_id) {
        const index = this.slides.findIndex((slide) => Number(slide.dataset.mediaId) === variant.featured_media_id);
        if (index >= 0 && index !== this.#index) this.goTo(index, { scroll: true });
      }
    }
  };

  /** Crosses out values that would lead to a sold-out or missing variant. */
  #updateAvailability(selected) {
    this.querySelectorAll('[data-option]').forEach((fieldset, position) => {
      fieldset.querySelectorAll('[data-option-input]').forEach((input) => {
        const candidate = [...selected];
        candidate[position] = input.value;
        const available = this.#variants.some(
          (v) => v.available && v.options.every((value, i) => value === candidate[i])
        );
        input.closest('.pdp__pill')?.classList.toggle('is-unavailable', !available);
      });
    });
  }

  #money(cents) {
    return formatMoney(cents, this.dataset.moneyFormat || '${{amount}}', this.dataset.currency || 'USD');
  }

  #renderVariant(variant) {
    const idInput = this.querySelector('[data-variant-id]');
    const button = this.querySelector('[data-add-button]');
    const buttonText = this.querySelector('[data-add-text]');

    if (idInput) idInput.value = variant ? String(variant.id) : '';

    if (button && buttonText) {
      const available = Boolean(variant?.available);
      button.disabled = !available;
      buttonText.textContent = !variant
        ? this.dataset.textUnavailable
        : available
          ? this.dataset.textAdd
          : this.dataset.textSoldOut;
    }

    if (!variant) {
      this.#renderStock('out', this.dataset.textUnavailable);
      return;
    }

    const current = this.querySelector('[data-price-current]');
    const compare = this.querySelector('[data-price-compare]');
    const badge = this.querySelector('[data-price-badge]');
    const saving = this.querySelector('[data-price-saving]');
    const onSale = variant.compare_at_price > variant.price;

    if (current) current.innerHTML = this.#money(variant.price);
    if (compare) {
      compare.hidden = !onSale;
      if (onSale) compare.innerHTML = this.#money(variant.compare_at_price);
    }
    if (badge) badge.hidden = !onSale;
    if (saving && onSale) saving.innerHTML = this.#money(variant.compare_at_price - variant.price);

    const lowStock = Number(this.dataset.lowStock) || 0;
    if (!variant.available) {
      this.#renderStock('out', 'Sold out');
    } else if (variant.inventory_tracked && variant.inventory_quantity > 0 && variant.inventory_quantity <= lowStock) {
      this.#renderStock('low', `Only ${variant.inventory_quantity} left`);
    } else {
      this.#renderStock('in', 'In stock');
    }
  }

  #renderStock(state, text) {
    const dot = this.querySelector('[data-stock-dot]');
    const label = this.querySelector('[data-stock-text]');
    if (dot) dot.className = `pdp__stock-dot pdp__stock-dot--${state}`;
    if (label) label.textContent = text;
  }

  #stepQuantity(step) {
    const input = this.querySelector('[data-qty-input]');
    if (!input) return;
    const next = Math.max(Number(input.min) || 1, (Number(input.value) || 1) + step);
    input.value = String(next);
  }

  /* ---------------------------------------------------------------------------
     Add to cart
     --------------------------------------------------------------------------- */

  #onSubmit = async (event) => {
    event.preventDefault();

    const button = this.querySelector('[data-add-button]');
    const buttonText = this.querySelector('[data-add-text]');
    const error = this.querySelector('[data-error]');
    if (!this.form || !button || button.disabled || button.classList.contains('is-loading')) return;

    const formData = new FormData(this.form);
    if (!formData.get('id')) return;

    if (error) error.hidden = true;
    button.classList.add('is-loading');

    const result = await addToCart({ source: this, formData, productId: this.dataset.productId });
    button.classList.remove('is-loading');

    if (!result.ok) {
      if (error) {
        error.textContent = result.message || 'Something went wrong. Please try again.';
        error.hidden = false;
      }
      return;
    }

    // Brief "Added" confirmation on the button.
    if (buttonText) {
      button.classList.add('is-added');
      buttonText.textContent = Theme.translations?.added || 'Added';
      clearTimeout(this.#addedTimer);
      this.#addedTimer = setTimeout(() => {
        button.classList.remove('is-added');
        buttonText.textContent = this.dataset.textAdd;
      }, 2000);
    }
  };

  /* ---------------------------------------------------------------------------
     Zoom
     --------------------------------------------------------------------------- */

  #zoomSources() {
    return [...(this.zoom?.querySelector('[data-zoom-sources]')?.content.children ?? [])];
  }

  #openZoom(index) {
    if (!this.zoom) return;
    this.#showZoom(index);
    this.zoom.showModal();
  }

  #stepZoom(step) {
    const count = this.#zoomSources().length;
    if (!count) return;
    this.#showZoom((this.#zoomIndex + step + count) % count);
  }

  #showZoom(index) {
    const source = this.#zoomSources()[index];
    const image = this.zoom?.querySelector('[data-zoom-image]');
    if (!source || !image) return;
    this.#zoomIndex = index;
    image.src = source.dataset.src;
    image.alt = source.dataset.alt || '';
  }
}

if (!customElements.get('product-page')) {
  customElements.define('product-page', ProductPage);
}
