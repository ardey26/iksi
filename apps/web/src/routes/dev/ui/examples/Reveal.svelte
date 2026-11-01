<script>
  // Composed example (c): the public "Tap to reveal" interstitial, kit only.
  import { Button, Container, EmptyState, IconButton, Input, Paper, Stack, toast } from '#lib/ui/index.js';

  let state = 'locked';
  const target = 'https://drive.example.com/s/q3-report';

  async function reveal() {
    state = 'revealing';
    await new Promise((r) => setTimeout(r, 700));
    state = 'revealed';
  }
</script>

<Container width="narrow">
  <Stack gap={16} align="stretch">
    <Paper>
      {#if state === 'revealed'}
        <EmptyState
          variant="page"
          icon="check"
          title="Here is your link"
          description="This was its only view. Save it now: it will not open again."
        >
          <Stack gap={12}>
            <Input label="Link" hideLabel readonly mono reserve={false} value="drive.example.com/s/q3-report">
              <IconButton slot="end" icon="copy" label="Copy link" on:click={() => toast('Link copied')} />
            </Input>
            <Button variant="primary" size="lg" full iconEnd="external" href={target}>Open link</Button>
          </Stack>
        </EmptyState>
      {:else}
        <EmptyState
          variant="page"
          icon="eye"
          title="Someone sent you a one-time link"
          description="It opens once. After you reveal it, nobody can open it again."
        >
          <Button variant="primary" size="lg" full loading={state === 'revealing'} on:click={reveal}>
            Tap to reveal
          </Button>
        </EmptyState>
      {/if}
    </Paper>
    <Stack align="center"><p class="t-caption t-faint">Shared with iksi</p></Stack>
  </Stack>
</Container>
