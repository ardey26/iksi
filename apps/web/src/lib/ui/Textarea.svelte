<script>
  import { onMount, tick } from 'svelte';
  import Field from './Field.svelte';
  import { uid } from './uid.js';

  export let value = '';
  export let id = uid('textarea');
  export let label = '';
  export let hint = '';
  export let error = '';
  export let optional = false;
  export let hideLabel = false;
  export let reserve = true;
  export let placeholder = '';
  export let disabled = false;
  export let readonly = false;
  export let rows = 3;
  /** Grow with the text up to maxRows, then scroll. */
  export let autosize = true;
  export let maxRows = 10;
  export let element = undefined;

  const LINE = 22;
  const PAD = 18;

  function fit() {
    if (!autosize || !element) return;
    element.style.height = 'auto';
    const max = maxRows * LINE + PAD;
    element.style.height = `${Math.min(element.scrollHeight, max)}px`;
    element.style.overflowY = element.scrollHeight > max ? 'auto' : 'hidden';
  }

  onMount(fit);
  $: value, tick().then(fit);
</script>

<Field {id} {label} {hint} {error} {optional} {hideLabel} {reserve} let:describedby let:invalid>
  <svelte:fragment slot="aside"><slot name="aside" /></svelte:fragment>
  <div class="ui-box" data-invalid={invalid || undefined} data-disabled={disabled || undefined}>
    <textarea
      data-ui
      class="ui-native"
      {id}
      {rows}
      {placeholder}
      {disabled}
      {readonly}
      aria-describedby={describedby}
      aria-invalid={invalid || undefined}
      bind:value
      bind:this={element}
      {...$$restProps}
      on:input
      on:change
      on:focus
      on:blur
      on:keydown
    ></textarea>
  </div>
</Field>
