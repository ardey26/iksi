<script>
	export let shortURL, copied;
</script>

<div class="absolute -bottom-14 left-0 w-full">
	{#if shortURL}
		<button
			class="w-full relative btn mt-3 py-6 bg-neutral-900 text-left normal-case"
			on:click={() => {
				navigator.clipboard.writeText(`${location.hostname}/${shortURL}`);
				copied = true;
				setTimeout(() => {
					copied = false;
				}, 2000);
			}}
		>
			<span class="absolute bottom-4 left-3">
				{location.hostname.replace("www.", "")}/{shortURL}
			</span>

			<div class="absolute bottom-2 right-3">
				{#if copied}
					<button type="submit" class="btn btn-sm btn-success"> copied </button>
				{:else}
					<button type="submit" class="btn btn-sm bg-neutral-800 btn-outline border-2 text-white"> copy </button>
				{/if}
			</div>
		</button>
	{/if}
</div>
