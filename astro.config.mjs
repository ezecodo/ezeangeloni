// @ts-check
import { defineConfig } from 'astro/config';

const live = { target: 'https://ezeangeloni.xyz', changeOrigin: true };

// https://astro.build/config
export default defineConfig({
	vite: {
		server: {
			// content lives only on the VPS; `astro dev` reads the real thing (SKY_LOCAL=ws://127.0.0.1:3010 tries a local shared sky)
			proxy: { '/api/sky': { target: process.env.SKY_LOCAL || 'wss://ezeangeloni.xyz', ws: true, changeOrigin: true }, '/frases.json': live, '/sets.json': live, '/images': live, '/sets/': live, '/links.json': live, '/links/': live, '/galaxies': live, '/api': process.env.API_LOCAL ? { target: process.env.API_LOCAL, changeOrigin: true } : live }, // API_LOCAL=http://127.0.0.1:3019 tries a local uploader
		},
	},
});
