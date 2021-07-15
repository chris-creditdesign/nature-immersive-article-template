import App from "./App.svelte";
import data from "./content/articledata.json";

let app;

function init() {
  /* ---------------------------- Svelte component ---------------------------- */
  app = new App({
    target: document.querySelector("#statically-rendered-html"),
    props: {
      data,
    },
    hydrate: true,
  });
}

document.addEventListener("DOMContentLoaded", init);

export default app;
