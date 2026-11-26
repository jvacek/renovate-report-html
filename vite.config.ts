import { fileURLToPath } from "node:url";
import preact from "@preact/preset-vite";
import * as simpleIcons from "simple-icons";
import { defineConfig, type Plugin } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";
import { DATASOURCE_ICONS } from "./src/viewer/datasource-icons.ts";

const repoRoot = fileURLToPath(new URL(".", import.meta.url));

/** `virtual:datasource-icons`: datasource -> { path, hex }, without the rest of each Simple Icons object. */
function datasourceIcons(): Plugin {
  const id = "virtual:datasource-icons";
  return {
    name: "datasource-icons",
    resolveId: (source) => (source === id ? `\0${id}` : undefined),
    load(loadId) {
      if (loadId !== `\0${id}`) return;
      // Each icon once, then datasources point at it (several share GitHub, Go, ...).
      const icons: Record<string, { path: string; hex: string }> = {};
      for (const [datasource, name] of Object.entries(DATASOURCE_ICONS)) {
        const icon = (simpleIcons as unknown as Record<string, simpleIcons.SimpleIcon | undefined>)[name];
        if (!icon) this.error(`simple-icons has no export ${name} (datasource ${datasource})`);
        icons[name] = { path: icon.path, hex: icon.hex };
      }
      const byDatasource = Object.entries(DATASOURCE_ICONS)
        .map(([datasource, name]) => `${JSON.stringify(datasource)}: icons.${name}`)
        .join(",\n");
      return `const icons = ${JSON.stringify(icons)};\nexport default {\n${byDatasource}\n};`;
    },
  };
}

export default defineConfig(({ command }) => ({
  root: "src/viewer",
  // True only under the dev server. Not import.meta.env.DEV: that follows NODE_ENV,
  // so a build under NODE_ENV=test (as in Vitest) would bundle the fixtures.
  define: { __DEV_SERVER__: JSON.stringify(command === "serve") },
  plugins: [datasourceIcons(), preact(), viteSingleFile({ removeViteModuleLoader: true })],
  build: {
    outDir: fileURLToPath(new URL("dist/viewer", import.meta.url)),
    emptyOutDir: true,
  },
  // The dev server loads reports from fixtures/, outside the viewer root.
  server: { fs: { allow: [repoRoot] } },
}));
