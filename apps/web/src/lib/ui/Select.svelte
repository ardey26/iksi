<script>
  import Field from './Field.svelte';
  import Icon from './Icon.svelte';
  import { uid } from './uid.js';

  export let value = undefined;
  export let id = uid('select');
  export let label = '';
  export let hint = '';
  export let error = '';
  export let optional = false;
  export let hideLabel = false;
  export let reserve = true;
  export let disabled = false;
  /** [{ value, label, disabled? }]. Or pass <option>s in the default slot. */
  export let options = [];
  export let element = undefined;
</script>

<Field {id} {label} {hint} {error} {optional} {hideLabel} {reserve} let:describedby let:invalid>
  <svelte:fragment slot="aside"><slot name="aside" /></svelte:fragment>
  <div class="ui-box box" data-invalid={invalid || undefined} data-disabled={disabled || undefined}>
    <select
      data-ui
      class="ui-native select"
      {id}
      {disabled}
      aria-describedby={describedby}
      aria-invalid={invalid || undefined}
      bind:value
      bind:this={element}
      {...$$restProps}
      on:change
      on:focus
      on:blur
    >
      {#each options as o (o.value)}
        <option value={o.value} disabled={o.disabled}>{o.label}</option>
      {/each}
      <slot />
    </select>
    <span class="chevron"><Icon name="chevron-down" /></span>
  </div>
</Field>

<style>
  .box { padding: 0; }
  .select {
    -webkit-appearance: none;
    appearance: none;
    /* Text starts 12px in; the chevron sits 14px from the right edge. */
    padding: 0 40px 0 12px;
    background-image: none;
    cursor: pointer;
    text-overflow: ellipsis;
  }
  .select:disabled { cursor: not-allowed; }
  .chevron {
    position: absolute;
    top: 50%;
    right: 14px;
    transform: translateY(-50%);
    color: var(--text-muted);
    pointer-events: none;
  }
</style>
