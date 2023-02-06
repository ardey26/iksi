<script>
	import { fade } from 'svelte/transition';

	export let error;

	console.log('TOAST', error);
</script>

<!-- svelte-ignore a11y-click-events-have-key-events -->
<div class="toast toast-top toast-end" out:fade={{ duration: 500 }}>
	<div class="border border-white alert alert-error text-white font-semibold">
		<div>
			<span>{error}</span>
		</div>
	</div>
</div>
