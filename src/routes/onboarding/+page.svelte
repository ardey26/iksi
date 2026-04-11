<script>
  import { enhance } from '$app/forms';

  export let data;
  export let form;

  let username = form?.username || data.suggestedUsername || '';
  let isSubmitting = false;
</script>

<svelte:head>
  <title>Choose your username | iksi</title>
</svelte:head>

<main class="onboarding-container">
  <div class="onboarding-card">
    <h1 class="onboarding-title">Choose your username</h1>
    <p class="onboarding-subtitle">This will be your profile URL</p>

    <form
      method="POST"
      use:enhance={() => {
        isSubmitting = true;
        return async ({ update }) => {
          isSubmitting = false;
          await update();
        };
      }}
    >
      <div class="input-group">
        <div class="input-wrapper" class:error={form?.error}>
          <input
            type="text"
            name="username"
            bind:value={username}
            placeholder="username"
            autocomplete="off"
            autocapitalize="off"
            spellcheck="false"
            minlength="3"
            maxlength="20"
            pattern="[a-zA-Z0-9-]+"
            required
          />
          <span class="input-suffix">.iksi.app</span>
        </div>
        {#if form?.error}
          <p class="error-text">{form.error}</p>
        {/if}
      </div>

      <button type="submit" class="btn btn-primary" disabled={isSubmitting}>
        {#if isSubmitting}
          <span class="spinner"></span>
        {:else}
          Continue
        {/if}
      </button>
    </form>

    <ul class="username-rules">
      <li>3-20 characters</li>
      <li>Letters, numbers, and hyphens only</li>
      <li>Cannot start or end with a hyphen</li>
    </ul>
  </div>
</main>

<style>
  .onboarding-container {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
  }

  .onboarding-card {
    max-width: 400px;
    width: 100%;
    text-align: center;
  }

  .onboarding-title {
    font-size: 24px;
    font-weight: 600;
    margin-bottom: 8px;
    color: var(--text-primary);
  }

  .onboarding-subtitle {
    color: var(--text-muted);
    margin-bottom: 32px;
    font-size: 14px;
  }

  .input-group {
    margin-bottom: 16px;
  }

  .input-wrapper {
    display: flex;
    align-items: center;
    background: var(--surface);
    border-radius: 12px;
    border: 1px solid var(--border);
    overflow: hidden;
    transition: border-color var(--duration-normal) var(--ease-out),
                box-shadow var(--duration-normal) var(--ease-out);
  }

  .input-wrapper:focus-within {
    border-color: var(--accent);
    box-shadow: 0 0 20px color-mix(in srgb, var(--accent) 15%, transparent);
  }

  .input-wrapper.error {
    border-color: var(--error);
    box-shadow: 0 0 20px color-mix(in srgb, var(--error) 15%, transparent);
  }

  .input-wrapper input {
    flex: 1;
    padding: 16px 20px;
    border: none;
    background: transparent;
    font-size: 18px;
    color: var(--text-primary);
    outline: none;
    min-width: 0;
    text-align: right;
  }

  .input-suffix {
    padding: 16px 20px 16px 0;
    color: var(--text-muted);
    font-size: 18px;
    user-select: none;
    white-space: nowrap;
  }

  .input-wrapper input::placeholder {
    color: var(--text-muted);
    opacity: 0.5;
  }

  .error-text {
    color: var(--error);
    font-size: 14px;
    margin-top: 8px;
    text-align: left;
  }

  .btn {
    width: 100%;
    padding: 16px 20px;
    min-height: 56px;
    border-radius: 12px;
    font-size: 16px;
    font-weight: 500;
    cursor: pointer;
    border: none;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .btn-primary {
    background: var(--accent);
    color: white;
  }

  .username-rules {
    margin-top: 32px;
    font-size: 12px;
    color: var(--text-muted);
    list-style: none;
    padding: 0;
  }

  .username-rules li {
    margin-bottom: 4px;
  }

  .spinner {
    width: 16px;
    height: 16px;
    border: 2px solid rgba(255, 255, 255, 0.3);
    border-top-color: white;
    border-radius: 50%;
    animation: spin 0.6s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }
</style>
