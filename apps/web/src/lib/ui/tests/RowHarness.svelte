<script>
  import Row from '../Row.svelte';
  import Logo from '../Logo.svelte';
  import MediaIcon from '../MediaIcon.svelte';

  export let mediaWidth = undefined;
  export let wrapSubtitle = false;
</script>

<ul>
  <Row title="GCash" subtitle="Quezon City, Philippines" {mediaWidth} {wrapSubtitle}>
    <span slot="leading" data-handle>grip</span>
    <Logo slot="media" src="/brands/gcash.svg" />
  </Row>
  <Row title="Maya" subtitle="Quezon City, Philippines" {mediaWidth} {wrapSubtitle}>
    <Logo slot="media" src="/brands/maya.svg" wordmark />
  </Row>
  <Row title="Venmo" {mediaWidth}>
    <MediaIcon slot="media" name="wallet" />
  </Row>
</ul>
