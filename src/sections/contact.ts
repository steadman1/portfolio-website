import { contact, intro, links } from '../content';
import { h, isExternal, reveal, roll } from '../lib/dom';

/** The contact section and footer at the bottom of the page. */
export function renderContact(root: HTMLElement) {
  root.append(
    h(
      'div',
      { class: 'contact-inner', 'data-reveal': true },
      reveal(h('h2', { class: 'label' }, contact.heading), 0),
      reveal(h('a', { class: 'contact-email roll', href: `mailto:${contact.email}` }, roll(contact.email)), 1),
      reveal(
        h(
          'ul',
          { class: 'link-row' },
          ...links
            .filter((link) => !link.href.startsWith('mailto:'))
            .map((link) =>
              h('li', {}, h('a', { class: 'roll', href: link.href, target: isExternal(link.href) ? '_blank' : null, rel: isExternal(link.href) ? 'noopener' : null }, roll(link.label))),
            ),
        ),
        2,
      ),
    ),
    h(
      'footer',
      { class: 'site-footer label' },
      h('span', {}, `© ${new Date().getFullYear()} ${intro.name}`),
      h('span', {}, 'Apartment modeled in Blender, rendered with three.js'),
    ),
  );
}
