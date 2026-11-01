<script>
  // Composed example (a): the dashboard "Payments" section, kit only.
  import { tick } from 'svelte';
  import {
    Button,
    EmptyState,
    IconButton,
    List,
    Logo,
    Monogram,
    Paper,
    Row,
    Section,
    Segmented,
    Skeleton,
    Stack,
    toast
  } from '#lib/ui/index.js';

  /** ready | empty | loading */
  export let state = 'ready';

  const START = [
    { id: 'gcash', name: 'GCash', detail: 'Pays to Maria Santos', logo: '/brands/gcash.svg' },
    { id: 'maya', name: 'Maya', detail: 'Pays to Maria Santos', logo: '/brands/maya.svg', inset: 0.1 },
    { id: 'bpi', name: 'BPI', detail: 'Pays to Maria Santos · Savings' },
    { id: 'paypal', name: 'PayPal', detail: 'paypal.me/mariasantos' }
  ];

  let methods = START.slice();
  let confirming = null;
  let label = 'pay';

  $: shown = state === 'empty' ? [] : methods;

  function move(i, dir) {
    const j = i + dir;
    if (j < 0 || j >= methods.length) return;
    const next = methods.slice();
    [next[i], next[j]] = [next[j], next[i]];
    methods = next;
  }

  // Keyboard focus follows the inline confirm in and back out.
  async function ask(m) {
    confirming = m.id;
    await tick();
    document.getElementById(`pay-${m.id}-cancel`)?.focus();
  }

  async function cancel(m) {
    confirming = null;
    await tick();
    document.getElementById(`pay-${m.id}-remove`)?.focus();
  }

  function remove(m) {
    methods = methods.filter((x) => x.id !== m.id);
    confirming = null;
    toast(`${m.name} removed`);
  }

  function add(kind) {
    toast(kind === 'qr' ? 'Choose a QR image to upload' : 'Paste a payment link');
  }

  $: if (state === 'ready' && methods.length === 0) methods = START.slice();
</script>

<Section
  title="Payments"
  description="A Pay button on your profile. People pick a method and pay you directly."
>
  <svelte:fragment slot="actions">
    <Segmented
      size="sm"
      label="Button label"
      bind:value={label}
      options={[
        { value: 'pay', label: 'Pay' },
        { value: 'tip', label: 'Send a tip' }
      ]}
    />
  </svelte:fragment>

  <Stack gap={16}>
    <Paper padding="none">
      {#if state === 'loading'}
        <List label="Payment methods loading">
          {#each [0, 1, 2] as i (i)}
            <Row>
              <Skeleton slot="leading" shape="square" height="40px" />
              <Skeleton width={i === 1 ? '64px' : '88px'} height="22px" />
              <Skeleton slot="subtitle" width="148px" height="18px" />
            </Row>
          {/each}
        </List>
      {:else if shown.length === 0}
        <EmptyState
          icon="wallet"
          title="No payment methods yet"
          description="Add a QR from your bank or e-wallet, or a payment link."
        >
          <Button variant="primary" icon="qr" on:click={() => add('qr')}>Add payment QR</Button>
        </EmptyState>
      {:else}
        <List label="Payment methods">
          {#each shown as m, i (m.id)}
            <Row title={m.name} subtitle={confirming === m.id ? 'Remove it from your Pay button?' : m.detail}>
              <svelte:fragment slot="leading">
                {#if m.logo}
                  <Logo src={m.logo} inset={m.inset ?? 0.15} />
                {:else}
                  <Monogram name={m.name} />
                {/if}
              </svelte:fragment>
              <svelte:fragment slot="actions">
                {#if confirming === m.id}
                  <Button size="sm" variant="ghost" id="pay-{m.id}-cancel" on:click={() => cancel(m)}>Cancel</Button>
                  <Button size="sm" variant="danger" on:click={() => remove(m)}>Remove</Button>
                {:else}
                  <IconButton icon="arrow-up" label="Move {m.name} up" disabled={i === 0} on:click={() => move(i, -1)} />
                  <IconButton icon="arrow-down" label="Move {m.name} down" disabled={i === shown.length - 1} on:click={() => move(i, 1)} />
                  <IconButton icon="trash" label="Remove {m.name}" variant="danger" id="pay-{m.id}-remove" on:click={() => ask(m)} />
                {/if}
              </svelte:fragment>
            </Row>
          {/each}
        </List>
      {/if}
    </Paper>

    {#if state !== 'empty'}
      <Stack direction="row" gap={8} wrap>
        <Button icon="qr" disabled={state === 'loading'} on:click={() => add('qr')}>Add payment QR</Button>
        <Button icon="link" disabled={state === 'loading'} on:click={() => add('link')}>Add payment link</Button>
      </Stack>
    {/if}
  </Stack>
</Section>
