/**
 * Moves a node to <body>, out of any clipping or transformed ancestor. A node
 * that came from inside a themed region (data-theme below <html>) keeps that
 * theme.
 */
export function portal(node) {
  const themed = node.parentElement?.closest('[data-theme]');
  if (themed && themed !== document.documentElement) {
    node.setAttribute('data-theme', themed.getAttribute('data-theme'));
  }
  document.body.appendChild(node);
  return {
    destroy() {
      node.remove();
    }
  };
}
