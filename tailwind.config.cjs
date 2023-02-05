const defaultTheme = require('tailwindcss/defaultTheme');
/** @type {import('tailwindcss').Config} */
module.exports = {
	content: ['./src/**/*.{html,js,svelte,ts}'],
	theme: {
		extend: {
			fontFamily: {
				Poppins: ['Poppins', ...defaultTheme.fontFamily.sans]
			}
		}
	},
	plugins: [require('daisyui')]
};
