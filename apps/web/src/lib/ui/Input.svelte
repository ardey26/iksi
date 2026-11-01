<script>
  import Field from './Field.svelte';
  import Icon from './Icon.svelte';
  import { uid } from './uid.js';

  export let value = '';
  export let id = uid('input');
  export let label = '';
  export let hint = '';
  export let error = '';
  export let optional = false;
  export let hideLabel = false;
  export let reserve = true;
  export let type = 'text';
  export let placeholder = '';
  export let disabled = false;
  export let readonly = false;
  /** Leading icon name. */
  export let icon = undefined;
  /** Trailing unit, e.g. "clicks". */
  export let unit = '';
  /** Monospace value, for short links and keys. */
  export let mono = false;
  /** end: right-aligned tabular numbers. */
  export let align = 'start';
  /** The native input, for focus management. */
  export let element = undefined;
</script>

<Field {id} {label} {hint} {error} {optional} {hideLabel} {reserve} let:describedby let:invalid>
  <svelte:fragment slot="aside"><slot name="aside" /></svelte:fragment>
  <div class="ui-box" data-invalid={invalid || undefined} data-disabled={disabled || undefined}>
    {#if icon}<Icon name={icon} />{/if}
    <input
      data-ui
      class="ui-native"
      class:mono
      class:end={align === 'end'}
      {id}
      {type}
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
      on:paste
    />
    {#if unit}<span class="ui-affix">{unit}</span>{/if}
    <slot name="end" />
  </div>
</Field>

<style>
  .mono {
    font-family: var(--font-mono);
    font-size: 14px;
    letter-spacing: -0.01em;
  }
  .end {
    text-align: right;
    font-variant-numeric: tabular-nums;
  }
  @media (max-width: 639px) {
    .mono { font-size: 16px; }
  }
</style>
