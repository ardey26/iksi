<script>
  import SortableList from '../SortableList.svelte';
  import DragHandle from '../DragHandle.svelte';
  import Row from '../Row.svelte';

  export let items = [
    { id: 'gcash', name: 'GCash' },
    { id: 'maya', name: 'Maya' },
    { id: 'bpi', name: 'BPI' },
    { id: 'paypal', name: 'PayPal' }
  ];
  export let onReorder = () => {};
</script>

<SortableList label="Payment methods" name={(m) => m.name} bind:items on:reorder={(e) => onReorder(e.detail)} let:item let:handle>
  <Row title={item.name}>
    <DragHandle slot="leading" {handle} />
  </Row>
</SortableList>
