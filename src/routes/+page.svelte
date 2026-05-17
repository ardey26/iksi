<script>
  import { Input, ShortenedURL } from '$lib/components/';
  import { onMount } from 'svelte';

  let longURL = '';
  let customURL = '';
  let shortURL = '';
  let isLoading = false;
  let error = '';
  let showCustomAlias = false;
  let inputRef;

  // Advanced settings state
  let showAdvancedSettings = false;
  let showPreviewPref = false;
  let isLoadingPref = true;

  onMount(async () => {
    // Auto-focus input on mount
    if (inputRef) {
      inputRef.focus();
    }

    // Fetch current preference
    try {
      const res = await fetch('/api/preferences');
      if (res.ok) {
        const data = await res.json();
        showPreviewPref = data.showPreview;
      }
    } catch {
      // Silently fail - use default
    } finally {
      isLoadingPref = false;
    }
  });

  const updatePreviewPref = async () => {
    const newValue = !showPreviewPref;
    showPreviewPref = newValue;

    try {
      await fetch('/api/preferences', {
        method: 'PATCH',
        body: JSON.stringify({ showPreview: newValue }),
        headers: { 'content-type': 'application/json' }
      });
    } catch {
      // Revert on error
      showPreviewPref = !newValue;
    }
  };

  const handleSubmit = async () => {
    if (isLoading) return;

    isLoading = true;
    error = '';

    try {
      const response = await fetch('/api/shorten', {
        method: 'POST',
        body: JSON.stringify({ longURL: longURL.trim(), customURL: customURL.trim() }),
        headers: { 'content-type': 'application/json' }
      });

      const data = await response.json();

      if (response.ok) {
        shortURL = data.shortURL;
        // Don't reset isLoading on success - component unmounts anyway
      } else {
        error = data.error || 'Something went wrong';
        setTimeout(() => { error = ''; }, 4000);
        isLoading = false;
      }
    } catch (err) {
      error = 'Network error. Please try again.';
      setTimeout(() => { error = ''; }, 4000);
      isLoading = false;
    }
  };

  const reset = () => {
    shortURL = '';
    longURL = '';
    customURL = '';
    showCustomAlias = false;
    error = '';
    isLoading = false;
    // Refocus input after reset
    setTimeout(() => {
      if (inputRef) inputRef.focus();
    }, 50);
  };

  const handleKeydown = (e) => {
    if (e.key === 'Escape') {
      if (shortURL) {
        reset();
      } else {
        longURL = '';
        customURL = '';
        error = '';
      }
    }
  };
</script>

<svelte:window on:keydown={handleKeydown} />

<div class="w-full max-w-[500px] px-4">
  {#if shortURL}
    <ShortenedURL {shortURL} on:reset={reset} />
  {:else}
    <Input
      bind:longURL
      bind:customURL
      bind:showCustomAlias
      bind:inputRef
      {isLoading}
      {error}
      {handleSubmit}
    />

    <!-- Advanced Settings -->
    <div class="advanced-settings">
      <button
        class="settings-toggle"
        on:click={() => showAdvancedSettings = !showAdvancedSettings}
        aria-expanded={showAdvancedSettings}
      >
        <span class="toggle-icon">{showAdvancedSettings ? '-' : '+'}</span>
        Advanced Settings
      </button>

      <div
        class="settings-content"
        class:expanded={showAdvancedSettings}
      >
        {#if !isLoadingPref}
          <label class="checkbox-label">
            <input
              type="checkbox"
              checked={showPreviewPref}
              on:change={updatePreviewPref}
            />
            <span class="checkbox-text">Always show preview before redirecting</span>
          </label>
        {/if}
      </div>
    </div>
  {/if}
</div>

<style>
  .advanced-settings {
    margin-top: 24px;
  }

  .settings-toggle {
    display: flex;
    align-items: center;
    gap: 8px;
    background: none;
    border: none;
    color: var(--text-muted);
    font-size: 14px;
    cursor: pointer;
    padding: 8px 0;
    transition: color var(--duration-normal) var(--ease-out);
  }

  .settings-toggle:hover {
    color: var(--text-primary);
  }

  .toggle-icon {
    width: 16px;
    text-align: center;
    font-weight: 500;
  }

  .settings-content {
    max-height: 0;
    opacity: 0;
    overflow: hidden;
    transition: max-height var(--duration-slow) var(--ease-out),
                opacity var(--duration-slow) var(--ease-out);
  }

  .settings-content.expanded {
    max-height: 100px;
    opacity: 1;
    padding-top: 8px;
  }

  .checkbox-label {
    display: flex;
    align-items: center;
    gap: 10px;
    cursor: pointer;
    padding: 8px 0;
  }

  .checkbox-label input[type="checkbox"] {
    width: 16px;
    height: 16px;
    accent-color: var(--accent);
    cursor: pointer;
  }

  .checkbox-text {
    font-size: 14px;
    color: var(--text-primary);
  }
</style>
