<script>
	import { fade } from 'svelte/transition';
</script>

<!-- svelte-ignore a11y-click-events-have-key-events -->
<div class="toast toast-top toast-end" out:fade={{ duration: 500 }}>
	<div class="border border-white alert alert-error text-white font-semibold">
		<div>
			<span>you entered an invalid url, try again</span>
		</div>
	</div>
</div>
