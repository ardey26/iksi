<script>
  import Sheet from '../Sheet.svelte';
  import Button from '../Button.svelte';
  import Input from '../Input.svelte';

  export let open = false;
</script>

<button type="button" on:click={() => (open = true)}>Open settings</button>
<Sheet bind:open title="Link settings" description="Changes save when you press Save.">
  <Input label="Destination" value="https://example.com" />
  <svelte:fragment slot="footer">
    <Button on:click={() => (open = false)}>Cancel</Button>
    <Button variant="primary">Save</Button>
  </svelte:fragment>
</Sheet>
