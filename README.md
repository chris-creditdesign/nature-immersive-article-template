# Nature Immersive Article Template

Template project to get started with a Nature immersive article.

## Get started

Install the dependencies...

    npm install

...then start [Rollup](https://rollupjs.org) and serve with [sirv-cli](https://github.com/lukeed/sirv):

    npm run dev

Navigate to [localhost:5000](http://localhost:5000). You should see your app running. Edit a component file in `src`, save it, and reload the page to see your changes.

## Build a SSR version of the page

To render the compiled client side js as `public/build/bundle.js`

    npm run build

To render a bundled version of the svelte app, which can be run in a node environment to create a SSR version of the app run:

    npm run build:ssr-js

To call `render-static-html.js` to create a static rendering of the html, containing the javascript and the css, as `public/index.html`:

    npm run build:ssr-html

To run all these processes together:

    npm run ssr
