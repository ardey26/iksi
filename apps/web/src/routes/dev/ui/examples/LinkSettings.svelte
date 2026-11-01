<script>
  // Composed example (b): a link row and its settings sheet, kit only.
  import {
    Badge,
    Button,
    Field,
    IconButton,
    Input,
    List,
    Monogram,
    Paper,
    Row,
    Segmented,
    Sheet,
    Stack,
    Switch,
    toast
  } from '#lib/ui/index.js';
  import { uid } from '#lib/ui/uid.js';

  export let open = false;

  const ids = { pw: uid('pw') };

  let destination = 'https://shop.mariasantos.ph/collections/holiday-sale';
  let redirect = '302';
  let expires = '';
  let limit = '';
  let locked = false;
  let password = '';
  let reveal = false;
  let saving = false;
  let errors = {};

  function validate() {
    const e = {};
    if (!/^(https?:\/\/)?[^\s.]+\.[^\s]+$/.test(destination.trim())) e.destination = 'Enter a web address, like example.com';
    const t = limit.trim();
    if (t && (!/^\d+$/.test(t) || Number(t) < 1)) e.limit = 'Enter a whole number above 0';
    if (locked && password.length > 0 && password.length < 4) e.password = 'Use at least 4 characters';
    return e;
  }

  async function save() {
    errors = validate();
    if (Object.keys(errors).length) return;
    saving = true;
    await new Promise((r) => setTimeout(r, 900));
    saving = false;
    open = false;
    toast('Settings saved', { variant: 'success' });
  }
</script>

<Paper padding="none">
  <List label="Links">
    <Row>
      <Monogram slot="leading" name="shop" />
      <span class="t-mono">iksi.app/sale</span>
      <svelte:fragment slot="subtitle">shop.mariasantos.ph</svelte:fragment>
      <svelte:fragment slot="meta">1,284</svelte:fragment>
      <svelte:fragment slot="actions">
        {#if locked}<Badge>Password</Badge>{/if}
        <IconButton icon="copy" label="Copy iksi.app/sale" on:click={() => toast('Link copied')} />
        <IconButton icon="settings" label="Settings for iksi.app/sale" on:click={() => (open = true)} />
      </svelte:fragment>
    </Row>
  </List>
</Paper>

<Sheet bind:open title="Link settings" description="iksi.app/sale" initialFocus="input">
  <Stack gap={16}>
    <Input
      label="Destination"
      icon="link"
      inputmode="url"
      hint="https:// is added if missing"
      error={errors.destination}
      bind:value={destination}
    />

    <Field label="Redirect" group hint="Permanent tells browsers to remember it." let:labelId>
      <Segmented
        full
        labelledby={labelId}
        bind:value={redirect}
        options={[
          { value: '302', label: 'Temporary' },
          { value: '301', label: 'Permanent' }
        ]}
      />
    </Field>

    <Input
      label="Expiry"
      type="datetime-local"
      hint="In your time zone. Empty means it never expires."
      bind:value={expires}
    >
      <svelte:fragment slot="aside">
        {#if expires}<Button size="sm" variant="ghost" on:click={() => (expires = '')}>Clear</Button>{/if}
      </svelte:fragment>
    </Input>

    <Input
      label="Click limit"
      inputmode="numeric"
      placeholder="No limit"
      align="end"
      unit={limit.trim() ? 'clicks' : ''}
      error={errors.limit}
      bind:value={limit}
    />

    <Field label="Password" group reserve={false} let:labelId>
      <Stack direction="row" gap={16} align="center" justify="space-between">
        <span id="{ids.pw}-desc" class="t-body t-muted">Ask for a password before redirecting</span>
        <Switch labelledby={labelId} describedby="{ids.pw}-desc" bind:checked={locked} />
      </Stack>
    </Field>

    {#if locked}
      <Input
        label="New password"
        hideLabel
        type={reveal ? 'text' : 'password'}
        placeholder="At least 4 characters"
        autocomplete="new-password"
        error={errors.password}
        bind:value={password}
      >
        <IconButton
          slot="end"
          icon={reveal ? 'eye-off' : 'eye'}
          label={reveal ? 'Hide password' : 'Show password'}
          on:click={() => (reveal = !reveal)}
        />
      </Input>
    {/if}
  </Stack>

  <svelte:fragment slot="footer">
    <Button on:click={() => (open = false)}>Cancel</Button>
    <Button variant="primary" loading={saving} on:click={save}>Save changes</Button>
  </svelte:fragment>
</Sheet>
