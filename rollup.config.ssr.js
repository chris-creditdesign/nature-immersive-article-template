import svelte from "rollup-plugin-svelte";
import resolve from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import json from "@rollup/plugin-json";
import css from "rollup-plugin-css-only";

// include this to avoid
// https://rollupjs.org/guide/en/#warning-treating-module-as-external-dependency

export default {
  input: "src/App.svelte",
  output: {
    format: "cjs",
    dir: "ssr",
  },
  plugins: [
    json(),
    commonjs(),
    svelte({
      // You can pass any of the Svelte compiler options
      compilerOptions: {
        // By default, the client-side compiler is used. You
        // can also use the server-side rendering compiler
        generate: "ssr",
      },
    }),
    css({ output: false }),
    resolve(),
  ],
};