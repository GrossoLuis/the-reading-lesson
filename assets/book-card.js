import { addToCart } from '@theme/cart-add';

/**
 * Product card behaviour (snippets/book-card.liquid), delegated from document so it
 * also covers cards that arrive later (filtering, pagination, recommendations).
 *
 * - [data-quick-add]: adds a single-variant product to the cart, then shows a tick.
 * - [data-wishlist]: toggles the product in a wishlist kept in localStorage
 *   ("trl:wishlist", a list of handles) until a wishlist app takes over. Fires
 *   "wishlist:change" on document with the full list.
 */

const WISHLIST_KEY = 'trl:wishlist';

function readWishlist() {
  try {
    const list = JSON.parse(localStorage.getItem(WISHLIST_KEY) || '[]');
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function writeWishlist(list) {
  try {
    localStorage.setItem(WISHLIST_KEY, JSON.stringify(list));
  } catch {
    // Storage unavailable (private mode): the heart still toggles for this page view.
  }
  document.dispatchEvent(new CustomEvent('wishlist:change', { detail: { handles: list } }));
}

function syncHearts(root = document) {
  const saved = new Set(readWishlist());
  root.querySelectorAll('[data-wishlist]').forEach((button) => {
    button.setAttribute('aria-pressed', String(saved.has(button.dataset.productHandle)));
  });
}

async function onQuickAdd(button) {
  if (button.classList.contains('is-loading')) return;
  button.classList.add('is-loading');

  const result = await addToCart({
    source: button,
    variantId: button.dataset.variantId,
    productId: button.dataset.productId,
  });

  button.classList.remove('is-loading');
  if (!result.ok) {
    button.setAttribute('title', result.message || '');
    return;
  }

  button.classList.add('is-added');
  setTimeout(() => button.classList.remove('is-added'), 1800);
}

function onWishlist(button) {
  const handle = button.dataset.productHandle;
  if (!handle) return;

  const list = readWishlist();
  const index = list.indexOf(handle);
  if (index === -1) list.push(handle);
  else list.splice(index, 1);

  writeWishlist(list);
  syncHearts();
}

if (!window.__bookCardReady) {
  window.__bookCardReady = true;

  document.addEventListener('click', (event) => {
    const target = /** @type {HTMLElement} */ (event.target);
    const quickAdd = target.closest('[data-quick-add]');
    if (quickAdd) {
      event.preventDefault();
      onQuickAdd(quickAdd);
      return;
    }

    const heart = target.closest('[data-wishlist]');
    if (heart) {
      event.preventDefault();
      onWishlist(heart);
    }
  });

  // Hearts rendered later (filtered grids) pick up their state too.
  let scheduled = false;
  new MutationObserver(() => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      syncHearts();
    });
  }).observe(document.body, { childList: true, subtree: true });
  window.addEventListener('storage', (event) => event.key === WISHLIST_KEY && syncHearts());
  syncHearts();
}
