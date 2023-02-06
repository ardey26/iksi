<!-- svelte-ignore a11y-missing-attribute -->
<script>
	import FaGithubSquare from 'svelte-icons/fa/FaGithubSquare.svelte';
	import FaGooglePlusSquare from 'svelte-icons/fa/FaGooglePlusSquare.svelte';
</script>

<footer class="footer relative text-white">
	<div class="absolute bottom-0 left-9">
		<p>Copyright © {new Date().getFullYear()} - All right reserved</p>
	</div>
	<div class="grid-flow-col gap-4 absolute bottom-0 right-12 w-[120px]">
		<div class="tooltip tooltip" data-tip="check out the repo!">
			<a href="http://www.github.com/ardey26/iksi.git" target="_blank" rel="noreferrer">
				<FaGithubSquare />
			</a>
		</div>
		<div class="tooltip" data-tip="shoot an email!">
			<a href="mailto: dejesusandre0226@gmail.com" target="_blank">
				<FaGooglePlusSquare />
			</a>
		</div>
	</div>
</footer>
