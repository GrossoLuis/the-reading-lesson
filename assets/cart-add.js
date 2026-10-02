import { CartLinesUpdateEvent, CartErrorEvent } from '@shopify/events';
import { fetchConfig } from '@theme/utilities';

/**
 * Adds a line to the cart the way Horizon's product form does: posts to
 * /cart/add.js and dispatches CartLinesUpdateEvent with a promise, so the cart
 * drawer re-renders (and auto-opens) and the header cart count updates.
 *
 * Shared by the product page and the product cards.
 *
 * @param {object} options
 * @param {HTMLElement} options.source - Element that dispatches the events.
 * @param {FormData} [options.formData] - A product form's data (must hold `id`).
 * @param {string|number} [options.variantId] - Used when there is no form.
 * @param {number} [options.quantity]
 * @param {string} [options.productId]
 * @returns {Promise<{ ok: boolean, message?: string }>}
 */
export async function addToCart({ source, formData, variantId, quantity = 1, productId }) {
  const data = formData ?? new FormData();
  if (variantId) data.set('id', String(variantId));
  const qty = Math.max(1, Number(data.get('quantity')) || quantity || 1);
  data.set('quantity', String(qty));

  // Ask for the cart drawer's sections so it can re-render from this response.
  const sectionIds = [...document.querySelectorAll('cart-items-component')]
    .map((element) => element instanceof HTMLElement && element.dataset.sectionId)
    .filter(Boolean);
  if (sectionIds.length) data.append('sections', sectionIds.join(','));

  const deferred = CartLinesUpdateEvent.createPromise();
  source.dispatchEvent(
    new CartLinesUpdateEvent({
      action: 'add',
      context: 'product',
      lines: [{ merchandiseId: String(data.get('id')), quantity: qty }],
      promise: deferred.promise,
    })
  );

  const config = fetchConfig('javascript', { body: data });

  try {
    const response = await fetch(Theme.routes.cart_add_url, {
      ...config,
      headers: { ...config.headers, Accept: 'text/html' },
    }).then((res) => res.json());

    const ajaxCart = await fetch(`${Theme.routes.cart_url}.json`, {
      headers: { Accept: 'application/json' },
      credentials: 'same-origin',
    }).then((res) => res.json());

    const cart = CartLinesUpdateEvent.createCartFromAjaxResponse(ajaxCart);

    if (response.status) {
      source.dispatchEvent(new CartErrorEvent({ error: response.message || 'Add to cart failed', code: 'INVALID' }));
      deferred.resolve({ cart, detail: { didError: true, items: ajaxCart.items, source: 'trl', itemCount: qty } });
      return { ok: false, message: response.description || response.message };
    }

    deferred.resolve({
      cart,
      detail: {
        items: ajaxCart.items,
        source: 'trl',
        itemCount: qty,
        productId,
        sections: response.sections,
        didError: false,
      },
    });
    return { ok: true };
  } catch (error) {
    deferred.reject(error);
    source.dispatchEvent(
      new CartErrorEvent({ error: error?.message || 'Network error', code: 'SERVICE_UNAVAILABLE' })
    );
    return { ok: false, message: 'Something went wrong. Please try again.' };
  }
}
