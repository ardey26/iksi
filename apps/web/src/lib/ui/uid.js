let n = 0;

/** A document-unique id for wiring labels, hints and errors. */
export function uid(prefix = 'ui') {
  n += 1;
  return `${prefix}-${n}`;
}
