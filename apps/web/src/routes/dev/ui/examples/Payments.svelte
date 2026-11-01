<script>
  // Composed example (a): the dashboard "Payments" section, kit only.
  import { tick } from 'svelte';
  import {
    Button,
    DragHandle,
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
    SortableList,
    Stack,
    toast
  } from '#lib/ui/index.js';

  /** ready | empty | loading */
  export let state = 'ready';

  const START = [
    { id: 'gcash', name: 'GCash', detail: 'Pays to Maria Santos', logo: '/brands/gcash.svg' },
    { id: 'maya', name: 'Maya', detail: 'Pays to Maria Santos', logo: '/brands/maya.svg', wordmark: true },
    { id: 'maribank', name: 'MariBank', detail: 'Pays to Maria Santos', logo: '/brands/maribank.png' },
    { id: 'bpi', name: 'BPI', detail: 'Pays to Maria Santos, savings' },
    { id: 'paypal', name: 'PayPal', detail: 'paypal.me/mariasantos' }
  ];

  let methods = START.slice();
  let confirming = null;
  let label = 'pay';

  $: shown = state === 'empty' ? [] : methods;

  // SortableList has already reordered `methods`; a screen would save the order.
  function saved(e) {
    toast(`Order saved: ${e.detail.ids.length} methods`);
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
              <svelte:fragment slot="leading">
                <DragHandle />
                <Skeleton shape="square" height="40px" />
              </svelte:fragment>
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
        <SortableList label="Payment methods" name={(m) => m.name} bind:items={methods} on:reorder={saved} let:item={m} let:handle>
          <Row subtitle={confirming === m.id ? 'Remove it from your Pay button?' : m.detail}>
            <!-- A wordmark already spells the name: kept for screen readers only. -->
            <span class:sr-only={m.wordmark}>{m.name}</span>
            <svelte:fragment slot="leading">
              <DragHandle {handle} />
              {#if m.logo}
                <Logo src={m.logo} wordmark={m.wordmark} />
              {:else}
                <Monogram name={m.name} />
              {/if}
            </svelte:fragment>
            <svelte:fragment slot="actions">
              {#if confirming === m.id}
                <Button size="sm" variant="ghost" id="pay-{m.id}-cancel" on:click={() => cancel(m)}>Cancel</Button>
                <Button size="sm" variant="danger" on:click={() => remove(m)}>Remove</Button>
              {:else}
                {#if m.id !== 'paypal'}<IconButton icon="edit" label="Rename {m.name}" on:click={() => toast(`Rename ${m.name}`)} />{/if}
                <IconButton icon="trash" label="Remove {m.name}" variant="danger" id="pay-{m.id}-remove" on:click={() => ask(m)} />
              {/if}
            </svelte:fragment>
          </Row>
        </SortableList>
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
