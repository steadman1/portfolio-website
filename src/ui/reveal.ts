/**
 * Elements with [data-reveal] get the class "is-in" the first time they
 * scroll into view. CSS does the actual animation (see "Reveals" in main.css).
 */
export function initReveal() {
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add('is-in');
        observer.unobserve(entry.target);
      }
    },
    { threshold: 0.15 },
  );
  document.querySelectorAll('[data-reveal]').forEach((el) => observer.observe(el));
}
