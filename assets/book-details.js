/**
 * Book details: follows the format picked on the product section. Format, pages,
 * dimensions and ISBN are variant metafields; their lines switch to the selected variant
 * and hide when it has no value. Markup lives in snippets/book-specs.liquid.
 */
class BookDetails extends HTMLElement {
  #variants = [];

  connectedCallback() {
    try {
      this.#variants = JSON.parse(this.querySelector('[data-spec-variants]')?.textContent || '[]');
    } catch {
      this.#variants = [];
    }
    document.addEventListener('pdp:variant-change', this.#onVariantChange);
  }

  disconnectedCallback() {
    document.removeEventListener('pdp:variant-change', this.#onVariantChange);
  }

  #onVariantChange = (event) => {
    const { productId, variantId } = event.detail ?? {};
    if (productId !== Number(this.dataset.productId)) return;

    const variant = this.#variants.find((v) => v.id === variantId);
    if (!variant) return;

    for (const key of ['format', 'pages', 'dimensions', 'isbn']) {
      const value = variant[key];
      const cell = this.querySelector(`[data-spec="${key}"]`);
      if (cell) cell.textContent = value ?? '';
      const row = this.querySelector(`[data-spec-row="${key}"]`);
      if (row) row.hidden = value === null || value === undefined || value === '';
    }
  };
}

if (!customElements.get('book-details')) {
  customElements.define('book-details', BookDetails);
}
