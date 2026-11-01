<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { PASSWORD_MIN, PASSWORD_MAX } from '#lib/password-limits.js';
  import {
    ONE_TIME_TEXT_MAX,
    ONE_TIME_TTL_DAYS,
    createOneTimeLink,
    oneTimeContentValid,
    type OneTimeKind
  } from '#lib/one-time.js';

  /** Dashboard create form for a one-time (burn after reading) link. */

  const dispatch = createEventDispatcher<{ created: Record<string, unknown> }>();
  const MAX_LABEL = ONE_TIME_TEXT_MAX.toLocaleString('en-US');

  let kind: OneTimeKind = 'url';
  let url = '';
  let text = '';
  let password = '';
  let busy = false;
  let error = '';

  $: content = kind === 'url' ? url : text;
  $: canCreate = oneTimeContentValid(kind, content) && !busy;

  async function create() {
    if (!canCreate) return;
    if (password !== '' && (password.length < PASSWORD_MIN || password.length > PASSWORD_MAX)) {
      error = `Password must be ${PASSWORD_MIN} to ${PASSWORD_MAX} characters`;
      return;
    }
    busy = true;
    error = '';
    const result = await createOneTimeLink({
      kind,
      content: kind === 'url' ? url.trim() : text,
      password: password || undefined
    });
    busy = false;
    if (!result.ok || !result.link) {
      error = result.ok ? 'Something went wrong' : result.error;
      return;
    }
    url = '';
    text = '';
    password = '';
    dispatch('created', result.link);
  }
</script>

<section class="d-section one-time" aria-labelledby="ot-title">
  <h2 class="d-title" id="ot-title">One-time link</h2>
  <p class="d-desc">A URL or a text that opens once, then it is erased. Unopened links expire after {ONE_TIME_TTL_DAYS} days.</p>

  <form class="d-spec" on:submit|preventDefault={create}>
    <div class="d-row">
      <span class="d-label" id="ot-kind-label">Content</span>
      <div class="d-control">
        <div class="d-seg" role="radiogroup" aria-labelledby="ot-kind-label">
          <label class="d-key">
            <input type="radio" class="sr-only" name="ot-kind" value="url" bind:group={kind} />
            <span>URL</span>
          </label>
          <label class="d-key">
            <input type="radio" class="sr-only" name="ot-kind" value="text" bind:group={kind} />
            <span>Text</span>
          </label>
        </div>
      </div>
    </div>

    <div class="d-row">
      {#if kind === 'url'}
        <label class="d-label" for="ot-url">Link to share</label>
        <div class="d-control">
          <input id="ot-url" class="d-field" type="text" inputmode="url" maxlength="2048" autocomplete="off"
                 spellcheck="false" placeholder="https://example.com/private" bind:value={url} />
          <p class="d-hint">Visitors go here once. https:// is added if missing.</p>
        </div>
      {:else}
        <label class="d-label" for="ot-text">Message</label>
        <div class="d-control">
          <textarea id="ot-text" class="d-field" rows="4" maxlength={ONE_TIME_TEXT_MAX}
                    aria-describedby="ot-count" bind:value={text}></textarea>
          <p class="d-hint count" id="ot-count" aria-live="polite">
            <span class="d-readout">{text.length.toLocaleString('en-US')} / {MAX_LABEL}</span>
          </p>
        </div>
      {/if}
    </div>

    <div class="d-row">
      <label class="d-label" for="ot-pw">Password</label>
      <div class="d-control">
        <input id="ot-pw" class="d-field" type="password" autocomplete="new-password" maxlength={PASSWORD_MAX}
               placeholder="Not set" aria-describedby="ot-pw-hint" bind:value={password} />
        <p class="d-hint" id="ot-pw-hint">Optional. Asked before it opens.</p>
      </div>
    </div>

    <div class="footer">
      <p class="err" role={error ? 'alert' : undefined}>{error}</p>
      <button type="submit" class="d-btn d-btn-primary" disabled={!canCreate}>
        {busy ? 'Creating' : 'Create one-time link'}
      </button>
    </div>
  </form>
</section>

<style>
  .one-time {
    margin-top: 48px;
  }
  textarea.d-field {
    min-height: 112px;
  }
  .count {
    text-align: right;
  }
  .count .d-readout {
    font-size: 13px;
  }
  .footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    padding-top: 16px;
  }
  .err {
    min-width: 0;
    min-height: 18px;
    font-size: 13px;
    line-height: 18px;
    color: var(--error);
  }
  .footer .d-btn {
    flex: none;
  }
</style>
