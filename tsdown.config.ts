import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["src/cli.ts"],
  outDir: "dist",
  format: "esm",
  platform: "node",
  // `vite build` writes the viewer template to dist/viewer first; keep it.
  clean: false,
  dts: false,
});
