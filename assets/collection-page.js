/**
 * Collection page (sections/collection.liquid): filtering, sorting and pagination
 * without a page reload, plus the mobile filter panel.
 *
 * Every change builds the URL from the filter form (the sort select joins it through
 * its `form` attribute), fetches this section through the Section Rendering API and
 * swaps the results block in place. The URL stays shareable and back/forward work.
 */
class CollectionPage extends HTMLElement {
  #controller = null;
  #priceTimer = 0;

  connectedCallback() {
    this.addEventListener('change', this.#onChange);
    this.addEventListener('input', this.#onInput);
    this.addEventListener('submit', this.#onSubmit);
    this.addEventListener('click', this.#onClick);
    document.addEventListener('keydown', this.#onKeydown);
    window.addEventListener('popstate', this.#onPopState);
  }

  disconnectedCallback() {
    document.removeEventListener('keydown', this.#onKeydown);
    window.removeEventListener('popstate', this.#onPopState);
  }

  get #form() {
    return this.querySelector('[data-filters-form]');
  }

  get #panel() {
    return this.querySelector('[data-filters]');
  }

  /* ---------- Events ---------- */

  #onChange = (event) => {
    const target = /** @type {HTMLElement} */ (event.target);
    if (target.matches('[data-price-input]')) return; // handled on input, debounced
    if (target.closest('[data-filters-form]') || target.matches('[data-sort]')) this.#apply();
  };

  #onInput = (event) => {
    if (!event.target.matches('[data-price-input]')) return;
    clearTimeout(this.#priceTimer);
    this.#priceTimer = setTimeout(() => this.#apply(), 700);
  };

  #onSubmit = (event) => {
    if (!event.target.matches('[data-filters-form]')) return;
    event.preventDefault();
    this.#apply();
  };

  #onClick = (event) => {
    const target = /** @type {HTMLElement} */ (event.target);

    const link = target.closest('a[data-ajax-link]');
    if (link) {
      event.preventDefault();
      const isPaging = link.closest('.collection__pagination');
      this.#render(link.href).then(() => isPaging && this.#scrollToResults());
      return;
    }

    if (target.closest('[data-filters-open]')) this.#togglePanel(true);
    else if (target.closest('[data-filters-close]')) this.#togglePanel(false);
  };

  #onKeydown = (event) => {
    if (event.key === 'Escape' && this.#panel?.classList.contains('is-open')) this.#togglePanel(false);
  };

  #onPopState = () => {
    this.#render(window.location.href, { push: false });
  };

  /* ---------- Filtering ---------- */

  #apply() {
    const form = this.#form;
    if (!form) return;

    const params = new URLSearchParams();
    for (const [key, value] of new FormData(form)) {
      if (typeof value === 'string' && value.trim() !== '') params.append(key, value.trim());
    }

    const url = new URL(form.action, window.location.origin);
    url.search = params.toString();
    this.#render(url.toString());
  }

  /**
   * @param {string} href
   * @param {{ push?: boolean }} [options]
   */
  async #render(href, { push = true } = {}) {
    const results = this.querySelector('[data-results]');
    if (!results) {
      window.location.href = href;
      return;
    }

    this.#controller?.abort();
    this.#controller = new AbortController();

    const url = new URL(href, window.location.origin);
    url.searchParams.delete('section_id');
    const fetchUrl = new URL(url);
    fetchUrl.searchParams.set('section_id', this.dataset.sectionId);

    results.classList.add('is-loading');

    try {
      const html = await fetch(fetchUrl, { signal: this.#controller.signal }).then((res) => {
        if (!res.ok) throw new Error(String(res.status));
        return res.text();
      });

      const doc = new DOMParser().parseFromString(html, 'text/html');
      const next = doc.querySelector('[data-results]');
      if (!next) throw new Error('No results in response');

      // Carry over UI state the server can't know: open panel, open/closed groups, focus.
      const panelOpen = this.#panel?.classList.contains('is-open');
      const openGroups = [...this.querySelectorAll('.collection__filter')].map((d) => d.open);
      const focused = /** @type {HTMLInputElement|null} */ (document.activeElement);
      const focusKey = focused && this.contains(focused) ? `${focused.name}|${focused.value}|${focused.id}` : null;

      results.replaceWith(next);

      this.querySelectorAll('.collection__filter').forEach((details, i) => {
        if (openGroups[i] !== undefined) details.open = openGroups[i];
      });
      if (panelOpen) this.#togglePanel(true, { focus: false });
      if (focusKey) {
        const [name, value, id] = focusKey.split('|');
        const match = id
          ? this.querySelector(`#${CSS.escape(id)}`)
          : [...this.querySelectorAll('input, select')].find((el) => el.name === name && el.value === value);
        /** @type {HTMLElement|null} */ (match)?.focus({ preventScroll: true });
      }

      if (push) window.history.pushState({}, '', url.toString());
    } catch (error) {
      if (error?.name === 'AbortError') return;
      window.location.href = url.toString();
    } finally {
      this.querySelector('[data-results]')?.classList.remove('is-loading');
    }
  }

  #scrollToResults() {
    const results = this.querySelector('[data-results]');
    if (!results) return;
    const top = results.getBoundingClientRect().top;
    if (top < 0) results.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  /* ---------- Mobile panel ---------- */

  #togglePanel(open, { focus = true } = {}) {
    const panel = this.#panel;
    if (!panel) return;
    const backdrop = this.querySelector('.collection__filters-backdrop');
    const toggle = this.querySelector('[data-filters-open]');

    panel.classList.toggle('is-open', open);
    if (backdrop) backdrop.hidden = !open;
    toggle?.setAttribute('aria-expanded', String(open));
    document.documentElement.style.overflow = open ? 'hidden' : '';

    if (!focus) return;
    if (open) panel.querySelector('[data-filters-close]')?.focus();
    else toggle?.focus();
  }
}

if (!customElements.get('collection-page')) {
  customElements.define('collection-page', CollectionPage);
}
