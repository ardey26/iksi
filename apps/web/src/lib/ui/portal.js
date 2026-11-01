/**
 * Moves a node to <body>, out of any clipping or transformed ancestor. A node
 * that came from inside a themed region (data-theme below <html>) keeps that
 * theme, and one from inside a palette region (data-palette: a public
 * profile's own colours, set as inline custom properties) keeps that palette.
 */
export function portal(node) {
  const themed = node.parentElement?.closest('[data-theme]');
  if (themed && themed !== document.documentElement) {
    node.setAttribute('data-theme', themed.getAttribute('data-theme'));
  }
  const palette = node.parentElement?.closest('[data-palette]');
  if (palette) {
    for (const prop of Array.from(palette.style)) {
      if (prop.startsWith('--')) node.style.setProperty(prop, palette.style.getPropertyValue(prop));
    }
  }
  document.body.appendChild(node);
  return {
    destroy() {
      node.remove();
    }
  };
}
