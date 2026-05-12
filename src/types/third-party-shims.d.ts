/**
 * Ambient modules for packages used without published (or bundled) TypeScript types.
 * Shrinks `tsc` noise; replace with real `@types/*` or generated types when available.
 */
declare module "react-filerobot-image-editor" {
  const FilerobotImageEditor: unknown;
  export default FilerobotImageEditor;
  export const TABS: unknown;
  export const TOOLS: unknown;
}
