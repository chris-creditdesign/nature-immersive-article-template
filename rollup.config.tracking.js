import babel from "@rollup/plugin-babel";

const config = {
  input: "src/tracking.js",
  output: {
    dir: "public/js/",
    format: "iife",
  },
  plugins: [babel({ babelHelpers: "bundled", comments: false })],
};

export default config;