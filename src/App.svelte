<script>
  import { onMount } from "svelte";
  import {
    Footer,
    Head,
    Heading,
    Menu,
  } from "nature-immersive-svelte-components";
  import { Stack, Center } from "creditdesign-svelte-components";
  import { allowAnimation } from "./stores/prefers-reduced-motion.js";

  export let data;

  let { articleData } = data;

  let mounted = false;

  onMount(() => {
    mounted = true;
    // allowAnimation should be true if the reader has set 'no-preference'
    // otherwise it should be false, and this should stop the animations
    // from being loaded
    let QUERY = "(prefers-reduced-motion: no-preference)";
    allowAnimation.set(window.matchMedia(QUERY).matches);
  });
</script>

<style>
  :global(body) {
    --global-stack-space: var(--s3);
  }

  :global(.heading) {
    margin-top: var(--global-stack-space);
  }

  main {
    margin: var(--global-stack-space);
  }
</style>

<Head articleData="{articleData}" />

<Menu articleData="{articleData}">
  <div slot="heading">
    <Heading articleData="{articleData}" />
  </div>

  <main id="main-content" tabindex="-1">
    <Center>
      <Stack>
        <p>Hello and welcome to the Nature immersive article template.</p>
        <p>Please use these files to start your project.</p>
        {#if mounted}
          <p>NB: The javascript has loaded.</p>
        {/if}
      </Stack>
    </Center>
  </main>
</Menu>
<Footer />
