import { defineConfig } from "vite";
import { resolve } from "node:path";

const outDir = "dist/content";

export default defineConfig({
  publicDir: false, // Disable public directory copying (main build handles it)
  build: {
    outDir,
    emptyOutDir: false,
    lib: {
      entry: resolve(__dirname, "src/content/index.ts"),
      name: "JobSnapContent",
      formats: ["iife"],
      fileName: () => "content.js"
    },
    rollupOptions: {
      output: {
        inlineDynamicImports: true
      }
    }
  }
});
