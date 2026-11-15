/**
 * Tiny helper for building HTML from code:
 *   h('a', { href: '/x' }, 'Label')
 * Props starting with "on" become event listeners; `true` becomes an empty
 * attribute; null/undefined/false props and children are skipped.
 */

type Child = Node | string | null | undefined | false;
type Props = Record<string, unknown>;

export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Props = {},
  ...children: (Child | Child[])[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (value == null || value === false) continue;
    if (key.startsWith('on') && typeof value === 'function') {
      el.addEventListener(key.slice(2).toLowerCase(), value as EventListener);
    } else if (key === 'class') {
      el.className = String(value);
    } else if (key === 'style' && typeof value === 'object') {
      for (const [prop, v] of Object.entries(value as Record<string, string>)) {
        el.style.setProperty(prop.startsWith('--') ? prop : prop.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase()), v);
      }
    } else {
      el.setAttribute(key, value === true ? '' : String(value));
    }
  }
  for (const child of children.flat()) {
    if (child == null || child === false) continue;
    el.append(child);
  }
  return el;
}

/**
 * Text for a "rolling" link or button: on hover the label slides down and a
 * copy rolls in from above. Give the link or button the class "roll" too:
 *   h('a', { class: 'roll', href: '/x' }, roll('Label'))
 */
export const roll = (label: string) => h('span', { class: 'roll-text' }, label);

/** Placeholder text from content.ts starts with "TODO". */
export const isTodo = (text: string | undefined) => !!text && text.trim().startsWith('TODO');

/** Renders text, marking "TODO" placeholders so they're easy to spot. */
export function text(value: string, className = ''): HTMLSpanElement {
  const cls = [className, isTodo(value) ? 'todo' : ''].filter(Boolean).join(' ');
  return h('span', { class: cls || null }, value);
}

/** Wraps content in a mask so it can slide up into view (see .reveal in CSS). */
export function reveal(child: Node, index = 0, tag: 'div' | 'span' = 'div'): HTMLElement {
  return h(tag, { class: 'reveal', style: { '--i': String(index) } }, h(tag, { class: 'reveal-inner' }, child));
}

export const isExternal = (href: string) => /^https?:\/\//.test(href);
