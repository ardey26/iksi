<script>
  import {
    Badge,
    Button,
    ChipGroup,
    EmptyState,
    IconButton,
    Icon,
    Input,
    List,
    Logo,
    Monogram,
    PageHeader,
    Paper,
    Row,
    Section,
    Segmented,
    Select,
    Sheet,
    Skeleton,
    Stack,
    Switch,
    Textarea,
    toast
  } from '#lib/ui/index.js';
  import { ICONS } from '#lib/ui/Icon.svelte';
  import Specimen from './Specimen.svelte';
  import Payments from './examples/Payments.svelte';
  import LinkSettings from './examples/LinkSettings.svelte';
  import Reveal from './examples/Reveal.svelte';

  const TOKENS = [
    ['--bg', 'Canvas'],
    ['--surface', 'Paper'],
    ['--surface-2', 'Inputs, hover, skeleton'],
    ['--border', 'Hairlines'],
    ['--border-strong', 'Hover edge'],
    ['--text-primary', 'Text'],
    ['--text-muted', 'Secondary text'],
    ['--text-faint', 'Captions'],
    ['--accent', 'Links, focus, active'],
    ['--success', 'Success'],
    ['--warning', 'Warning'],
    ['--error', 'Error']
  ];

  const TYPE = [
    ['t-display', 'Display', '36/40 · 44/48 from 768 · 700 · -0.03em', 'Payments'],
    ['t-title', 'Title', '20/26 · 600 · -0.015em', 'Link settings'],
    ['t-body', 'Body', '15/22 · 400', 'People pick a method and pay you directly.'],
    ['t-label', 'Label', '13/18 · 500', 'Destination'],
    ['t-caption', 'Caption', '12/16 · 400', 'Updated 2 days ago'],
    ['t-readout', 'Readout', '15/20 · 500 · tabular', '12,480 · 1,284 · 3.2%']
  ];

  const VARIANTS = ['primary', 'secondary', 'ghost', 'danger'];
  const SIZES = [
    ['sm', '32'],
    ['md', '40'],
    ['lg', '48']
  ];

  let loading = false;
  function fakeSave() {
    loading = true;
    setTimeout(() => (loading = false), 1500);
  }

  let confirmRemove = false;

  let sw = { a: false, b: true };
  let seg = { a: 'week', b: '302', c: 'list' };
  let chips = ['ios', 'web'];
  let text = { plain: '', filled: 'iksi.app/sale', note: '' };
  let paymentsState = 'ready';
  let sheetOpen = false;
  let plainSheet = false;
</script>

<div class="gallery">
  <PageHeader
    back="/dashboard"
    backLabel="Dashboard"
    title="UI kit"
    description="Every component in src/lib/ui, in every state. Development only."
  >
    <svelte:fragment slot="actions">
      <Button icon="external" href="https://composer.trade" target="_blank" rel="noopener">Reference</Button>
      <Button variant="primary" icon="plus" on:click={() => toast('Primary action')}>New link</Button>
    </svelte:fragment>
  </PageHeader>

  <!-- Composed examples first: they are what the screens will look like. -->
  <Section title="Example: dashboard payments" description="Section, Paper, List, Row, Logo, Monogram, IconButton, Button, Segmented.">
    <Stack gap={24}>
      <Segmented
        size="sm"
        label="Example state"
        bind:value={paymentsState}
        options={[
          { value: 'ready', label: 'With methods' },
          { value: 'empty', label: 'Empty' },
          { value: 'loading', label: 'Loading' }
        ]}
      />
      <div class="example">
        <Payments state={paymentsState} />
      </div>
    </Stack>
  </Section>

  <Section title="Example: link settings sheet" description="Row with actions, Sheet, Input, Segmented, Switch, Field. Try Save with a click limit of 0.">
    <div class="example">
      <LinkSettings bind:open={sheetOpen} />
    </div>
  </Section>

  <Section title="Example: tap to reveal" description="Public interstitial: centred 480 column, one Paper, icon, Title, one line, one action.">
    <div class="frame">
      <Reveal />
    </div>
  </Section>

  <Section title="Type" description="Geist, one family. Sentence case; no uppercase labels.">
    <Paper padding="none">
      <List label="Type roles">
        {#each TYPE as [cls, name, spec, sample] (cls)}
          <li class="type-row">
            <div class="type-meta">
              <span class="t-label">{name}</span>
              <span class="t-caption t-faint">{spec}</span>
            </div>
            <span class="{cls} type-sample">{sample}</span>
          </li>
        {/each}
        <li class="type-row">
          <div class="type-meta">
            <span class="t-label">Mono</span>
            <span class="t-caption t-faint">Short links and keys only</span>
          </div>
          <span class="t-body t-mono type-sample">iksi.app/abc · iksi_ab12…</span>
        </li>
      </List>
    </Paper>
  </Section>

  <Section title="Colour" description="Neutral UI. Accent marks links, focus and the active state of a control.">
    <div class="swatches">
      {#each TOKENS as [token, use] (token)}
        <div class="swatch">
          <span class="chip-color" style="background: var({token});"></span>
          <span class="t-label">{token}</span>
          <span class="t-caption t-muted">{use}</span>
        </div>
      {/each}
    </div>
  </Section>

  <Section title="Button" description="Pill. Primary is inverted and appears once per view. Loading keeps the width.">
    <Stack gap={24}>
      {#each SIZES as [size, px] (size)}
        <Specimen label="{px}px">
          {#each VARIANTS as v (v)}
            <Button variant={v} {size}>{v === 'danger' ? 'Delete' : v[0].toUpperCase() + v.slice(1)}</Button>
          {/each}
          <Button {size} icon="plus">With icon</Button>
          <Button {size} variant="ghost" iconEnd="chevron-right">Trailing</Button>
        </Specimen>
      {/each}
      <Specimen label="Disabled">
        {#each VARIANTS as v (v)}
          <Button variant={v} disabled>{v === 'danger' ? 'Delete' : 'Disabled'}</Button>
        {/each}
      </Specimen>
      <Specimen label="Loading (click)">
        <Button variant="primary" {loading} on:click={fakeSave}>Save changes</Button>
        <Button {loading} on:click={fakeSave}>Upload QR</Button>
        <Button variant="primary" loading>Saving</Button>
      </Specimen>
      <Specimen label="Focus">
        <span class="g-focus"><Button variant="primary">Focused</Button></span>
      </Specimen>
      <Specimen label="Danger confirms inline">
        {#if confirmRemove}
          <span class="t-body t-muted">Remove this link?</span>
          <Button size="sm" variant="ghost" on:click={() => (confirmRemove = false)}>Cancel</Button>
          <Button size="sm" variant="danger" on:click={() => { confirmRemove = false; toast('Link removed'); }}>Remove</Button>
        {:else}
          <Button size="sm" variant="danger" icon="trash" on:click={() => (confirmRemove = true)}>Remove link</Button>
        {/if}
      </Specimen>
      <Specimen label="Full width">
        <div class="narrow"><Button variant="primary" size="lg" full>Continue</Button></div>
      </Specimen>
    </Stack>
  </Section>

  <Section title="Icon button" description="Always labelled; the label is also the tooltip.">
    <Stack gap={24}>
      <Specimen label="Ghost · 32 and 40">
        <IconButton icon="copy" label="Copy" />
        <IconButton icon="settings" label="Settings" />
        <IconButton icon="more" label="More" />
        <IconButton icon="copy" label="Copy" size="md" />
        <IconButton icon="settings" label="Settings" size="md" />
      </Specimen>
      <Specimen label="Secondary, danger, disabled">
        <IconButton icon="plus" label="Add" variant="secondary" />
        <IconButton icon="plus" label="Add" variant="secondary" size="md" />
        <IconButton icon="trash" label="Delete" variant="danger" />
        <IconButton icon="arrow-up" label="Move up" disabled />
      </Specimen>
      <Specimen label="Focus">
        <span class="g-focus"><IconButton icon="settings" label="Settings" /></span>
      </Specimen>
      <Specimen label="Icons · 16 and 20 · 1.5px stroke">
        <div class="icons">
          {#each Object.keys(ICONS) as name (name)}
            <span class="icon-cell" title={name}><Icon {name} size={20} /><span class="t-caption t-faint">{name}</span></span>
          {/each}
        </div>
      </Specimen>
    </Stack>
  </Section>

  <Section title="Field" description="40px, radius 10. Label above; hint and error share one reserved line below.">
    <Paper>
      <div class="field-grid">
        <Input label="Default" placeholder="Paste a long link" bind:value={text.plain} />
        <Input label="Filled" mono bind:value={text.filled} />
        <Input label="With hint" hint="https:// is added if missing" icon="link" placeholder="example.com" />
        <Input label="Error" value="0" align="end" unit="clicks" error="Enter a whole number above 0" />
        <Input label="Disabled" value="iksi.app/locked" disabled />
        <Input label="Optional" optional placeholder="No limit" align="end" />
        <Select
          label="Select"
          hint="Native menu, drawn chevron"
          value="7d"
          options={[
            { value: '24h', label: 'Last 24 hours' },
            { value: '7d', label: 'Last 7 days' },
            { value: '30d', label: 'Last 30 days' }
          ]}
        />
        <Select label="Select error" error="Pick a country" value="">
          <option value="" disabled>Choose…</option>
          <option value="ph">Philippines</option>
        </Select>
        <div class="span-2">
          <Textarea label="Textarea" placeholder="Grows with the text" hint="Up to 10 lines, then it scrolls" bind:value={text.note} />
        </div>
        <div class="g-focus-field"><Specimen focus column><Input label="Focus" value="Focused field" /></Specimen></div>
      </div>
    </Paper>
  </Section>

  <Section title="Switch, Segmented, Chips">
    <Stack gap={24}>
      <Specimen label="Switch: off, on, disabled, focus">
        <Switch label="Off" bind:checked={sw.a} />
        <Switch label="On" bind:checked={sw.b} />
        <Switch label="Disabled off" disabled />
        <Switch label="Disabled on" checked disabled />
        <span class="g-focus"><Switch label="Focused" checked /></span>
      </Specimen>
      <Specimen label="Segmented · 40 and 32 · arrow keys move">
        <Segmented
          label="Range"
          bind:value={seg.a}
          options={[
            { value: 'day', label: 'Day' },
            { value: 'week', label: 'Week' },
            { value: 'month', label: 'Month' },
            { value: 'year', label: 'Year' }
          ]}
        />
        <Segmented
          size="sm"
          label="View"
          bind:value={seg.c}
          options={[
            { value: 'list', label: 'List', icon: 'grip' },
            { value: 'qr', label: 'QR', icon: 'qr' }
          ]}
        />
      </Specimen>
      <Specimen label="Segmented · full width, one option disabled">
        <div class="narrow">
          <Segmented
            full
            label="Redirect"
            bind:value={seg.b}
            options={[
              { value: '302', label: 'Temporary' },
              { value: '301', label: 'Permanent' },
              { value: 'meta', label: 'Meta', disabled: true }
            ]}
          />
        </div>
      </Specimen>
      <Specimen label="Chips (multi-select)">
        <ChipGroup
          label="Devices"
          bind:value={chips}
          options={[
            { value: 'ios', label: 'iOS' },
            { value: 'android', label: 'Android' },
            { value: 'web', label: 'Desktop' },
            { value: 'bots', label: 'Bots', disabled: true }
          ]}
        />
      </Specimen>
    </Stack>
  </Section>

  <Section title="Badge, Logo, Monogram">
    <Stack gap={24}>
      <Specimen label="Badge">
        <Badge>Neutral</Badge>
        <Badge variant="accent">Default</Badge>
        <Badge variant="success" dot>Active</Badge>
        <Badge variant="warning">Expires soon</Badge>
        <Badge variant="error">Flagged</Badge>
        <Badge>1,284</Badge>
      </Specimen>
      <Specimen label="Logo (no chip) and Monogram · 40 and 32">
        <Logo src="/brands/gcash.svg" alt="GCash" />
        <Logo src="/brands/maya.svg" alt="Maya" />
        <Logo src="/brands/maribank.png" alt="MariBank" />
        <Monogram name="BPI" />
        <Monogram name="paypal" />
        <Logo src="/brands/gcash.svg" alt="GCash" size={32} />
        <Monogram name="Union Bank" size={32} />
      </Specimen>
    </Stack>
  </Section>

  <Section title="List and Row" description="56px rows, hairlines inside paper, numbers right-aligned.">
    <Paper padding="none">
      <List label="Top links">
        <Row interactive title="iksi.app/sale" subtitle="shop.mariasantos.ph">
          <Monogram slot="leading" name="shop" />
          <svelte:fragment slot="meta">12,480</svelte:fragment>
        </Row>
        <Row interactive subtitle="docs.google.com · Expires Oct 15">
          <Monogram slot="leading" name="docs" />
          <span class="t-mono">iksi.app/q3</span>
          <svelte:fragment slot="meta">1,284</svelte:fragment>
          <svelte:fragment slot="actions">
            <Badge variant="warning">Expires soon</Badge>
          </svelte:fragment>
        </Row>
        <Row title="A very long title that has to truncate before it reaches the trailing meta and actions" subtitle="youtube.com/watch?v=dQw4w9WgXcQ&list=PL1234567890abcdef">
          <Monogram slot="leading" name="YouTube" />
          <svelte:fragment slot="meta">48</svelte:fragment>
          <svelte:fragment slot="actions">
            <IconButton icon="copy" label="Copy" />
            <IconButton icon="settings" label="Settings" />
          </svelte:fragment>
        </Row>
        <Row muted title="iksi.app/old" subtitle="Disabled · 2 days ago">
          <Monogram slot="leading" name="old" />
          <svelte:fragment slot="meta">0</svelte:fragment>
        </Row>
      </List>
    </Paper>
  </Section>

  <Section title="Skeleton" description="Bars at the final layout size: the loaded row replaces it without moving.">
    <div class="pair">
      <Paper padding="none">
        <List label="Loading">
          {#each [96, 72, 120] as w (w)}
            <Row>
              <Skeleton slot="leading" shape="square" height="40px" />
              <Skeleton width="{w}px" height="22px" />
              <Skeleton slot="subtitle" width="{w + 60}px" height="18px" />
              <Skeleton slot="meta" width="40px" height="20px" />
            </Row>
          {/each}
        </List>
      </Paper>
      <Paper padding="none">
        <List label="Loaded">
          <Row title="iksi.app/sale" subtitle="shop.mariasantos.ph"><Monogram slot="leading" name="shop" /><svelte:fragment slot="meta">12,480</svelte:fragment></Row>
          <Row title="iksi.app/q3" subtitle="docs.google.com"><Monogram slot="leading" name="docs" /><svelte:fragment slot="meta">1,284</svelte:fragment></Row>
          <Row title="iksi.app/yt" subtitle="youtube.com/@mariasantos"><Monogram slot="leading" name="yt" /><svelte:fragment slot="meta">48</svelte:fragment></Row>
        </List>
      </Paper>
    </div>
  </Section>

  <Section title="Empty state" description="Icon, one line, one primary action.">
    <Paper padding="none">
      <EmptyState icon="link" title="No links yet" description="Shorten your first link and it shows up here.">
        <Button variant="primary" icon="plus">Shorten a link</Button>
      </EmptyState>
    </Paper>
  </Section>

  <Section title="Paper and Section" description="One level of paper on the canvas. 48px between sections.">
    <div class="pair">
      <Paper padding="sm"><p class="t-body t-muted">Paper, 16px padding</p></Paper>
      <Paper><p class="t-body t-muted">Paper, 24px padding</p></Paper>
    </div>
  </Section>

  <Section title="Toast and Sheet">
    <Stack gap={24}>
      <Specimen label="Toast: bottom centre, one line, 4s, aria-live">
        <Button on:click={() => toast('Link copied')}>Neutral</Button>
        <Button on:click={() => toast('Settings saved', { variant: 'success' })}>Success</Button>
        <Button on:click={() => toast('Could not reach the server', { variant: 'error' })}>Error</Button>
      </Specimen>
      <Specimen label="Sheet: bottom on phones, side from 768">
        <Button on:click={() => (sheetOpen = true)}>Open link settings</Button>
        <Button on:click={() => (plainSheet = true)}>Open long sheet</Button>
      </Specimen>
    </Stack>
  </Section>
</div>

<Sheet bind:open={plainSheet} title="Long content" description="The body scrolls; the footer stays put.">
  <Stack gap={12}>
    {#each Array.from({ length: 24 }, (_x, i) => i) as i (i)}
      <p class="t-body t-muted">Paragraph {i + 1}. The sheet body scrolls on its own while the page behind stays locked.</p>
    {/each}
  </Stack>
  <svelte:fragment slot="footer">
    <Button on:click={() => (plainSheet = false)}>Close</Button>
    <Button variant="primary" on:click={() => (plainSheet = false)}>Done</Button>
  </svelte:fragment>
</Sheet>

<style>
  .gallery {
    min-width: 0;
    color: var(--text-primary);
  }
  .example { max-width: 720px; }
  .frame {
    padding: 64px 0;
    background-color: var(--bg);
    border: 1px dashed var(--border);
    border-radius: var(--radius-paper);
  }
  .narrow {
    width: 100%;
    max-width: 360px;
  }

  .type-row {
    display: grid;
    grid-template-columns: 200px minmax(0, 1fr);
    align-items: baseline;
    gap: 24px;
    padding: 16px;
  }
  .type-meta {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .type-sample {
    min-width: 0;
    overflow-wrap: anywhere;
  }
  @media (max-width: 639px) {
    .type-row { grid-template-columns: minmax(0, 1fr); gap: 8px; }
  }

  .swatches {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
    gap: 16px;
  }
  .swatch {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .chip-color {
    display: block;
    height: 48px;
    margin-bottom: 8px;
    border-radius: var(--radius-control);
    box-shadow: inset 0 0 0 1px var(--border);
  }

  .icons {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(96px, 1fr));
    gap: 8px;
    width: 100%;
    color: var(--text-muted);
  }
  .icon-cell {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    padding: 12px 4px;
  }

  .field-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 16px 24px;
  }
  .span-2 { grid-column: 1 / -1; }
  @media (max-width: 639px) {
    .field-grid { grid-template-columns: minmax(0, 1fr); }
  }

  .pair {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    gap: 16px;
  }

  /* Static focus rings for the screenshots; real focus uses :focus-visible. */
  .g-focus { display: inline-flex; }
  .g-focus :global(:is(button, a)[data-ui]) {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }
</style>
