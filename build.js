import * as esbuild from 'esbuild';

await esbuild.build({
    entryPoints: ['src/index.ts'],
    bundle: true,
    outfile: 'dist/index.js',
    format: 'esm',
    platform: 'node',
    external: ['@supabase/node-fetch'],
    banner: {
        js: `
    import { createRequire } from 'module';
    const require = createRequire(import.meta.url);
  `
    }
});
