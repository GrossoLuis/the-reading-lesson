/**
 * Story scroll (sections/story-scroll.liquid).
 *
 * - Scene colours: the scene crossing the middle of the screen sets data-scene on the
 *   section, which recolours it (CSS). Runs with an IntersectionObserver, so it works
 *   with reduced motion and without GSAP too. The chapter pill follows it.
 * - Letter fill ([data-fill]): text is split into letters that go from pale to full,
 *   scrubbed by the scroll. The opening is pinned (CSS sticky) while its headline fills.
 * - [data-rise] fades up once, [data-count] counts up once, [data-image] and
 *   [data-photo] open up with the scroll, [data-speed] shapes drift (parallax).
 *
 * GSAP 3.12.5 + ScrollTrigger are self-hosted in assets and loaded by the section.
 * Horizon scrolls .page-wrapper on desktop (≥990px) and the window on mobile.
 */

const DESKTOP = '(min-width: 990px)';

/** Runs `callback` once GSAP and ScrollTrigger are on the page. */
function whenGsapReady(callback, onFail, tries = 0) {
  if (window.gsap && window.ScrollTrigger) {
    callback(window.gsap, window.ScrollTrigger);
    return;
  }
  if (tries > 80) {
    onFail();
    return;
  }
  setTimeout(() => whenGsapReady(callback, onFail, tries + 1), 50);
}

function scrollerElement() {
  return window.matchMedia(DESKTOP).matches ? document.querySelector('.page-wrapper') : null;
}

/**
 * Splits an element's text into words and letters, keeping inline markup (em, strong,
 * br). Screen readers get the plain text once; the letters are aria-hidden.
 * @param {HTMLElement} element
 * @returns {HTMLElement[]} the letters
 */
function splitLetters(element) {
  if (element.dataset.split === 'true') return [...element.querySelectorAll('.sf-char')];

  const label = document.createElement('span');
  label.className = 'sf-hidden';
  label.textContent = element.textContent.replace(/\s+/g, ' ').trim();

  const visual = document.createElement('span');
  visual.setAttribute('aria-hidden', 'true');

  /** @param {Node} source @param {Node} target */
  const copy = (source, target) => {
    source.childNodes.forEach((node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        node.textContent.split(/(\s+)/).forEach((token) => {
          if (!token) return;
          if (/^\s+$/.test(token)) {
            target.appendChild(document.createTextNode(' '));
            return;
          }
          const word = document.createElement('span');
          word.className = 'sf-word';
          for (const char of token) {
            const letter = document.createElement('span');
            letter.className = 'sf-char';
            letter.textContent = char;
            word.appendChild(letter);
          }
          target.appendChild(word);
        });
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        const clone = /** @type {Element} */ (node).cloneNode(false);
        copy(node, clone);
        target.appendChild(clone);
      }
    });
  };

  copy(element, visual);
  element.replaceChildren(label, visual);
  element.dataset.split = 'true';
  return [...visual.querySelectorAll('.sf-char')];
}

/** "200,000+" → counts the number part up, keeps the rest. */
function countUp(gsap, element) {
  if (element.dataset.counted === 'true') return;
  const template = element.textContent.trim();
  const match = template.match(/\d[\d,]*/);
  if (!match) return;
  element.dataset.counted = 'true';
  // Years ("1990s") and small numbers stay as they are.
  if (/^(19|20)\d\d$/.test(match[0])) return;
  const target = Number(match[0].replace(/,/g, ''));
  if (!Number.isFinite(target) || target < 10) return;
  const grouped = match[0].includes(',');
  const counter = { value: 0 };
  gsap.to(counter, {
    value: target,
    duration: 1.8,
    ease: 'power2.out',
    onUpdate: () => {
      const value = Math.round(counter.value);
      element.textContent = template.replace(match[0], grouped ? value.toLocaleString('en-US') : String(value));
    },
  });
}

class StoryScroll extends HTMLElement {
  #mm = null;
  #observer = null;
  #scroller = null;

  connectedCallback() {
    this.#watchScenes();
    window.matchMedia(DESKTOP).addEventListener('change', this.#onBreakpoint);

    whenGsapReady(
      (gsap, ScrollTrigger) => {
        gsap.registerPlugin(ScrollTrigger);
        this.#animate(gsap, ScrollTrigger);
      },
      () => document.documentElement.classList.remove('story-scroll-motion')
    );
  }

  disconnectedCallback() {
    this.#mm?.revert();
    this.#observer?.disconnect();
    this.#scroller?.removeEventListener('scroll', this.#onScroll);
    window.matchMedia(DESKTOP).removeEventListener('change', this.#onBreakpoint);
  }

  #onBreakpoint = () => {
    this.#observer?.disconnect();
    this.#scroller?.removeEventListener('scroll', this.#onScroll);
    this.#watchScenes();
  };

  /* ---------- Scene colours and the chapter pill ---------- */

  #watchScenes() {
    const scenes = [...this.querySelectorAll('[data-scene-color]')];
    const pill = this.querySelector('[data-pill]');
    const root = scrollerElement();

    this.#observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const scene = /** @type {HTMLElement} */ (entry.target);
          this.dataset.scene = scene.dataset.sceneColor;
          pill?.classList.add('is-visible');
          const number = pill?.querySelector('[data-pill-number]');
          const label = pill?.querySelector('[data-pill-label]');
          if (number) number.textContent = scene.dataset.sceneNumber;
          if (label) label.textContent = `· ${scene.dataset.sceneLabel}`;
        });
      },
      // A thin line across the middle of the screen.
      { root, rootMargin: '-50% 0px -50% 0px' }
    );
    scenes.forEach((scene) => this.#observer.observe(scene));

    this.#scroller = root || window;
    this.#scroller.addEventListener('scroll', this.#onScroll, { passive: true });
    this.#onScroll();
  }

  /** Back above the first scene: opening colour, no pill. Also drives the pill bar. */
  #onScroll = () => {
    const scenes = this.querySelectorAll('[data-scene-color]');
    const first = scenes[0];
    const last = scenes[scenes.length - 1];
    if (!first) return;

    const viewport = window.innerHeight;
    const middle = viewport / 2;
    const top = first.getBoundingClientRect().top;
    const bottom = last.getBoundingClientRect().bottom;

    if (top > middle) {
      this.dataset.scene = this.dataset.openingColor;
      this.querySelector('[data-pill]')?.classList.remove('is-visible');
    }
    if (bottom < viewport * 0.3) this.querySelector('[data-pill]')?.classList.remove('is-visible');

    const progress = Math.min(1, Math.max(0, (middle - top) / (bottom - top)));
    this.style.setProperty('--story-progress', progress.toFixed(3));
  };

  /* ---------- Motion ---------- */

  #animate(gsap, ScrollTrigger) {
    const opening = this.querySelector('[data-opening]');

    this.#mm = gsap.matchMedia();
    this.#mm.add(
      { desktop: DESKTOP, motion: '(prefers-reduced-motion: no-preference)' },
      (context) => {
        const { desktop, motion } = context.conditions;
        const scroller = desktop ? document.querySelector('.page-wrapper') || window : window;

        if (!motion) {
          this.classList.remove('is-animated');
          document.documentElement.classList.remove('story-scroll-motion');
          return;
        }

        // Split every text that fills in, then show it (pale) from here on.
        const fills = [...this.querySelectorAll('[data-fill]')].map((el) => ({ el, chars: splitLetters(el) }));
        this.classList.add('is-animated');
        document.documentElement.classList.remove('story-scroll-motion');

        // Opening: headline fills while the opening is pinned; shapes pop in.
        fills.forEach(({ el, chars }) => {
          const inOpening = opening?.contains(el);
          gsap.fromTo(
            chars,
            { opacity: 0.16 },
            {
              opacity: 1,
              ease: 'none',
              stagger: 0.04,
              scrollTrigger: inOpening
                ? {
                    trigger: opening,
                    scroller,
                    start: 'top top',
                    end: () => `+=${Math.max(200, opening.offsetHeight - window.innerHeight * 1.25)}`,
                    scrub: 0.6,
                  }
                : { trigger: el, scroller, start: 'top 82%', end: 'bottom 48%', scrub: 0.6 },
            }
          );
        });

        gsap.from(this.querySelectorAll('.story-scroll__opening .story-scroll__shape'), {
          scale: 0,
          rotate: -30,
          opacity: 0,
          duration: 1,
          ease: 'back.out(1.8)',
          stagger: 0.08,
          delay: 0.15,
        });

        // Parallax shapes.
        this.querySelectorAll('[data-speed]').forEach((shape) => {
          const speed = Number(/** @type {HTMLElement} */ (shape).dataset.speed) || 0;
          const trigger = shape.closest('[data-opening], [data-scene-color]');
          gsap.to(shape, {
            y: speed * 140,
            rotate: speed * 12,
            ease: 'none',
            scrollTrigger: { trigger, scroller, start: 'top bottom', end: 'bottom top', scrub: true },
          });
        });

        // Text that rises in once.
        this.querySelectorAll('[data-rise]').forEach((el) =>
          gsap.fromTo(
            el,
            { opacity: 0, y: 28 },
            {
              opacity: 1,
              y: 0,
              duration: 0.8,
              ease: 'power2.out',
              scrollTrigger: { trigger: el, scroller, start: 'top 88%', once: true },
            }
          )
        );

        // Numbers count up when they arrive.
        this.querySelectorAll('[data-count]').forEach((el) =>
          ScrollTrigger.create({
            trigger: el,
            scroller,
            start: 'top 85%',
            once: true,
            onEnter: () => countUp(gsap, el),
          })
        );

        // Shaped images grow and straighten; the photo drifts inside.
        this.querySelectorAll('[data-image]').forEach((frame) => {
          const tilted = frame.classList.contains('story-scroll__image--tilted');
          gsap.fromTo(
            frame,
            { scale: 0.82, rotate: tilted ? -9 : -5 },
            {
              scale: 1,
              rotate: tilted ? -3 : 0,
              ease: 'none',
              scrollTrigger: { trigger: frame, scroller, start: 'top bottom', end: 'center 55%', scrub: 0.6 },
            }
          );
          const image = frame.querySelector('img, svg');
          if (image)
            gsap.fromTo(
              image,
              { yPercent: -7, scale: 1.16 },
              {
                yPercent: 7,
                scale: 1.16,
                ease: 'none',
                scrollTrigger: { trigger: frame, scroller, start: 'top bottom', end: 'bottom top', scrub: true },
              }
            );
        });

        // Closing photo opens up from an inset.
        this.querySelectorAll('[data-photo]').forEach((photo) =>
          gsap.fromTo(
            photo,
            { clipPath: 'inset(10% 12% 10% 12% round 32px)' },
            {
              clipPath: 'inset(0% 0% 0% 0% round 32px)',
              ease: 'none',
              scrollTrigger: { trigger: photo, scroller, start: 'top 95%', end: 'top 35%', scrub: true },
            }
          )
        );

        // Layout can shift once fonts and images settle.
        document.fonts?.ready.then(() => ScrollTrigger.refresh());
        window.addEventListener('load', () => ScrollTrigger.refresh(), { once: true });
      }
    );
  }
}

if (!customElements.get('story-scroll')) {
  customElements.define('story-scroll', StoryScroll);
}
