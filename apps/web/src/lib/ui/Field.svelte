<script>
  // Label above, control in the default slot, hint or error below. The
  // message line keeps its height, so an error never moves the layout.
  import { uid } from './uid.js';

  export let id = uid('field');
  export let label = '';
  export let hint = '';
  export let error = '';
  /** Adds a quiet "Optional" after the label. */
  export let optional = false;
  /** Keeps the label for assistive tech only. */
  export let hideLabel = false;
  /** Reserve the message line even when there is no hint or error. */
  export let reserve = true;
  /** For group controls (Segmented, ChipGroup, Switch): the label names the
      control through aria-labelledby={labelId} instead of for=. */
  export let group = false;

  $: labelId = `${id}-label`;
  $: hintId = `${id}-hint`;
  $: errorId = `${id}-error`;
  $: describedby = error ? errorId : hint ? hintId : undefined;
</script>

<div class="field">
  {#if label}
    <div class="head" class:sr-only={hideLabel}>
      {#if group}
        <span class="label" id={labelId}>
          {label}{#if optional}<span class="optional">Optional</span>{/if}
        </span>
      {:else}
        <label class="label" id={labelId} for={id}>
          {label}{#if optional}<span class="optional">Optional</span>{/if}
        </label>
      {/if}
      <div class="aside"><slot name="aside" /></div>
    </div>
  {/if}

  <slot {id} {labelId} {describedby} invalid={!!error} />

  <div class="message" class:reserve>
    <!-- Always present so a new error is announced, never inserted silently. -->
    <p id={errorId} class="error" aria-live="polite">{error}</p>
    {#if hint && !error}<p id={hintId} class="hint">{hint}</p>{/if}
  </div>
</div>

<style>
  .field {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }
  .head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 8px;
  }
  .label {
    font-size: 13px;
    line-height: 18px;
    font-weight: 500;
    color: var(--text-primary);
  }
  .optional {
    margin-left: 6px;
    font-weight: 400;
    color: var(--text-faint);
  }
  .aside {
    font-size: 13px;
    line-height: 18px;
  }
  .aside:empty { display: none; }
  .message {
    display: grid;
    margin-top: 6px;
  }
  /* Unreserved and empty: no gap, but the live region stays in the tree. */
  .message:not(.reserve):has(.error:empty):not(:has(.hint)) { margin-top: 0; }
  .message.reserve { min-height: 16px; }
  /* Hint and error share one cell: whichever shows takes the same line. */
  .error,
  .hint {
    grid-area: 1 / 1;
    margin: 0;
    font-size: 12px;
    line-height: 16px;
  }
  .error { color: var(--error); }
  .hint { color: var(--text-muted); }
</style>
