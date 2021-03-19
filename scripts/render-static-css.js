const fs = require("fs");

const files = [
  "node_modules/nature-immersive-svelte-components/static/css/fonts.css",
  "node_modules/nature-immersive-svelte-components/static/css/custom-props.css",
  "node_modules/nature-immersive-svelte-components/static/css/light-theme.css",
  "node_modules/nature-immersive-svelte-components/static/css/index.css",
];

const filesToString = files
  .map((file) => {
    return fs.readFileSync(file).toString();
  })
  .join("\n");

fs.writeFileSync("./public/css/index.css", filesToString, "utf8");
