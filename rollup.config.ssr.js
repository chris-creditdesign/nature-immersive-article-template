import svelte from "rollup-plugin-svelte";
import sveltePreprocess from "svelte-preprocess";
import json from "@rollup/plugin-json";

export default {
  input: "src/App.svelte",
  output: {
    format: "cjs",
    // Output to a directory for multiple code split files.
    dir: "ssr/",
  },
  plugins: [
    json(),
    svelte({
      preprocess: sveltePreprocess({
        postcss: {
          plugins: [require("autoprefixer")()],
        },
      }),
      // Use the server-side rendering compiler
      generate: "ssr",
    }),
  ],
};
