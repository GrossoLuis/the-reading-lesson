/**
 * Shopify product recommendations for sections/book-recommendations.liquid.
 *
 * When the row comes within 400px of the viewport, fetches the same section from
 * /recommendations/products (data-url), which renders the book cards, and swaps them in.
 * With no recommendations, or on an error, the whole section is removed.
 */
class BookRecommendations extends HTMLElement {
  #observer = null;

  connectedCallback() {
    if (this.hasAttribute('data-performed')) return;

    this.#observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        this.#observer.disconnect();
        this.#load();
      },
      { rootMargin: '0px 0px 400px 0px' }
    );
    this.#observer.observe(this);
  }

  disconnectedCallback() {
    this.#observer?.disconnect();
  }

  async #load() {
    try {
      const response = await fetch(this.dataset.url);
      if (!response.ok) throw new Error(`Recommendations: ${response.status}`);

      const html = new DOMParser().parseFromString(await response.text(), 'text/html');
      const content = html.querySelector('book-recommendations [data-recs-content]');

      if (!content?.querySelector('.book-shelf')) {
        this.#remove();
        return;
      }

      this.querySelector('[data-recs-content]')?.replaceWith(content);
    } catch (error) {
      console.error(error);
      this.#remove();
    }
  }

  #remove() {
    // Keep the empty section visible in the theme editor so it can still be selected.
    if (window.Shopify?.designMode) {
      this.querySelector('[data-recs-content]')?.replaceChildren();
      return;
    }
    this.closest('.shopify-section')?.remove();
  }
}

if (!customElements.get('book-recommendations')) {
  customElements.define('book-recommendations', BookRecommendations);
}
