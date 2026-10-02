/**
 * Our story scrollytelling (sections/our-story.liquid), built on GSAP + ScrollTrigger
 * (self-hosted in assets, loaded by the section).
 *
 * - Opening: headline words rise in, then the eyebrow, lede and scroll cue fade up.
 * - Chapters (desktop): as each chapter text crosses the middle of the screen it
 *   becomes active, the sticky card swaps to its statement, the progress dots move
 *   and the colour bar fills with the scroll. Numbers count up when shown.
 * - Quote: words ink in from pale to full colour, scrubbed by the scroll.
 * - Photo: the colour-bar frame opens up from a smaller inset as it scrolls in.
 *
 * Horizon scrolls .page-wrapper on desktop (≥990px) and the document on mobile, so
 * every trigger is given the right scroller for its breakpoint.
 */

const DESKTOP = '(min-width: 990px)';

/** Runs `callback` once GSAP and ScrollTrigger are on the page. */
function whenGsapReady(callback, tries = 0) {
  if (window.gsap && window.ScrollTrigger) {
    callback(window.gsap, window.ScrollTrigger);
    return;
  }
  if (tries > 80) {
    document.documentElement.classList.remove('story-motion');
    return;
  }
  setTimeout(() => whenGsapReady(callback, tries + 1), 50);
}

/** "200,000+" → animates the number part, keeps the rest. */
function countUp(gsap, element, target) {
  if (!element || element.dataset.counted === 'true') return;
  element.dataset.counted = 'true';
  const template = element.textContent.trim();
  const counter = { value: 0 };
  gsap.to(counter, {
    value: target,
    duration: 1.6,
    ease: 'power2.out',
    onUpdate: () => {
      const formatted = Math.round(counter.value).toLocaleString('en-US');
      element.textContent = /[\d,]+/.test(template) ? template.replace(/[\d,]+/, formatted) : formatted;
    },
  });
}

class OurStory extends HTMLElement {
  #mm = null;

  connectedCallback() {
    whenGsapReady((gsap, ScrollTrigger) => {
      gsap.registerPlugin(ScrollTrigger);
      this.#setup(gsap, ScrollTrigger);
    });
  }

  disconnectedCallback() {
    this.#mm?.revert();
  }

  #setup(gsap, ScrollTrigger) {
    const words = this.querySelectorAll('.story__word > span');
    const intro = this.querySelectorAll('[data-intro]');
    const chapters = [...this.querySelectorAll('[data-chapter]')];
    const states = [...this.querySelectorAll('[data-state]')];
    const dots = [...this.querySelectorAll('[data-progress-dot]')];
    const texts = this.querySelector('.story__texts');
    const inks = this.querySelectorAll('.story__ink');
    const photo = this.querySelector('[data-photo]');
    const photoImage = photo?.querySelector('img, svg');

    const root = getComputedStyle(document.documentElement);
    const ink = root.getPropertyValue('--color-ink').trim() || '#1D2340';
    const grape = root.getPropertyValue('--color-grape').trim() || '#5A4A8C';

    const setActive = (index) => {
      chapters.forEach((c, i) => c.classList.toggle('is-active', i === index));
      states.forEach((s, i) => s.classList.toggle('is-active', i === index));
      dots.forEach((d, i) => d.classList.toggle('is-active', i === index));
      const stat = states[index]?.querySelector('[data-count]');
      if (stat) countUp(gsap, stat, Number(stat.dataset.count));
    };

    this.#mm = gsap.matchMedia();

    this.#mm.add(
      {
        desktop: DESKTOP,
        mobile: '(max-width: 989px)',
        motion: '(prefers-reduced-motion: no-preference)',
      },
      (context) => {
        const { desktop, motion } = context.conditions;
        const scroller = desktop ? document.querySelector('.page-wrapper') || window : window;

        // Reduced motion: show the finished state, keep chapter focus on desktop.
        if (!motion) {
          document.documentElement.classList.remove('story-motion');
          this.querySelectorAll('[data-count]').forEach((el) => (el.dataset.counted = 'true'));
          if (desktop && texts) {
            chapters.forEach((chapter, i) =>
              ScrollTrigger.create({
                trigger: chapter,
                scroller,
                start: 'top 55%',
                end: 'bottom 55%',
                onToggle: (self) => self.isActive && setActive(i),
              })
            );
          }
          return;
        }

        // Opening
        // y: 0 on both ends: GSAP would otherwise read the CSS translateY(105%) as a px
        // offset and keep it on top of the yPercent tween.
        gsap.fromTo(
          words,
          { yPercent: 105, y: 0 },
          { yPercent: 0, y: 0, duration: 0.9, ease: 'power3.out', stagger: 0.055, delay: 0.1 }
        );
        gsap.fromTo(
          intro,
          { opacity: 0, y: 14 },
          { opacity: 1, y: 0, duration: 0.8, ease: 'power2.out', stagger: 0.12, delay: 0.45 }
        );

        // Chapters
        if (desktop && texts) {
          chapters.forEach((chapter, i) =>
            ScrollTrigger.create({
              trigger: chapter,
              scroller,
              start: 'top 55%',
              end: 'bottom 55%',
              onToggle: (self) => self.isActive && setActive(i),
            })
          );

          ScrollTrigger.create({
            trigger: texts,
            scroller,
            start: 'top 60%',
            end: 'bottom 60%',
            onUpdate: (self) => this.style.setProperty('--story-progress', self.progress.toFixed(3)),
          });
          this.style.setProperty('--story-progress', '0');
        } else {
          // Mobile: each chapter's statement counts up when it scrolls into view.
          this.querySelectorAll('.story__chapter-stat [data-count]').forEach((el) =>
            ScrollTrigger.create({
              trigger: el,
              scroller,
              start: 'top 85%',
              once: true,
              onEnter: () => countUp(gsap, el, Number(el.dataset.count)),
            })
          );
          chapters.forEach((chapter) =>
            gsap.fromTo(
              chapter,
              { opacity: 0, y: 24 },
              {
                opacity: 1,
                y: 0,
                duration: 0.7,
                ease: 'power2.out',
                scrollTrigger: { trigger: chapter, scroller, start: 'top 85%', once: true },
              }
            )
          );
        }

        // Quote ink
        if (inks.length) {
          gsap.to(inks, {
            color: (i, el) => (el.classList.contains('story__accent') ? grape : ink),
            stagger: 0.1,
            ease: 'none',
            scrollTrigger: {
              trigger: inks[0].closest('.story__quote'),
              scroller,
              start: 'top 75%',
              end: 'bottom 55%',
              scrub: true,
            },
          });
        }

        // Photo
        if (photo) {
          gsap.fromTo(
            photo,
            { clipPath: 'inset(7% 9% 7% 9% round 32px)', scale: 0.97 },
            {
              clipPath: 'inset(0% 0% 0% 0% round 32px)',
              scale: 1,
              ease: 'none',
              scrollTrigger: { trigger: photo, scroller, start: 'top 92%', end: 'top 35%', scrub: true },
            }
          );
          if (photoImage) {
            gsap.fromTo(
              photoImage,
              { yPercent: -4, scale: 1.08 },
              {
                yPercent: 4,
                scale: 1.08,
                ease: 'none',
                scrollTrigger: { trigger: photo, scroller, start: 'top bottom', end: 'bottom top', scrub: true },
              }
            );
          }
        }

        // Layout can shift once fonts and images settle.
        document.fonts?.ready.then(() => ScrollTrigger.refresh());
        window.addEventListener('load', () => ScrollTrigger.refresh(), { once: true });
      }
    );
  }
}

if (!customElements.get('our-story')) {
  customElements.define('our-story', OurStory);
}
