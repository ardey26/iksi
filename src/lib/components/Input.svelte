<!-- svelte-ignore a11y-label-has-associated-control -->
<script>
	export let handleSubmit, longURL, customURL;
</script>

<form on:submit|preventDefault={handleSubmit} class="form-control flex flex-col gap-4">
	<div class="relative">
		<label class="label text-white text-3xl"> go ahead, shorten something </label>
		<div class="row">
			<input
				type="text"
				name="longURL"
				id="longURL"
				placeholder="Paste your long URL here…"
				bind:value={longURL}
				class="pl-3 pr-[7rem] w-full h-[3rem] rounded-md border border-gray-300 bg-neutral-900 text-white text-base"
			/>
			<div class="absolute bottom-0 right-0">
				<button type="submit" class="btn btn-outline px-8 border-2 bg-neutral-700 text-white lowercase">
					enter
				</button>
			</div>
		</div>
	</div>
	<div class="form-group flex flex-col justify-end items-end">
		<label class="label" for="customURL">
			<span class="label-text text-white text-lg mr-2"> wanna make a custom one? </span>
		</label>
		<input
			type="text"
			name="customURL"
			id="customURL"
			bind:value={customURL}
			maxlength="24"
			class="p-2 w-full rounded-md border border-gray-300 bg-neutral-900 text-white truncate text-base"
			placeholder="Optional custom link..."
		/>
	</div>
</form>
