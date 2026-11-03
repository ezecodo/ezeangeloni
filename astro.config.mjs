// @ts-check
import { defineConfig } from 'astro/config';

const live = { target: 'https://ezeangeloni.xyz', changeOrigin: true };

// https://astro.build/config
export default defineConfig({
	vite: {
		server: {
			// content lives only on the VPS; `astro dev` reads the real thing
			proxy: { '/frases.json': live, '/sets.json': live, '/images': live, '/sets/': live, '/links.json': live, '/links/': live, '/galaxies': live },
		},
	},
});
