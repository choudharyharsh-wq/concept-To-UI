// Ambient declarations for side-effect CSS imports (e.g. `import "tldraw/tldraw.css"`).
// Without this, TS's stricter resolution (bundler/node16) reports ts(2882):
// "Cannot find module or type declarations for side-effect import".
declare module "*.css";
