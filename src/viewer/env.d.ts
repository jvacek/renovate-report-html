/** Set by vite.config.ts: true under the dev server, false in builds. */
declare const __DEV_SERVER__: boolean;
/** Set by vite.config.ts from package.json. */
declare const __APP_VERSION__: string;
/** Set by vite.config.ts from package.json's repository URL. */
declare const __REPO_URL__: string;

declare module "virtual:datasource-icons" {
  /** Built by vite.config.ts from src/viewer/datasource-icons.ts. */
  const icons: Record<string, { path: string; hex: string }>;
  export default icons;
}
