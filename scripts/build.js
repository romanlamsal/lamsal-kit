import * as esbuild from "esbuild"

await esbuild.build({
    entryPoints: ["lamsal-kit.ts"],
    bundle: true,
    outfile: "build/lamsal-kit.js",
    format: "esm",
    platform: "node",
    banner: {
        js: `
    import { createRequire } from 'module';
    const require = createRequire(import.meta.url);
  `,
    },
})
