# Nature Immersive Article Template

Template project to get started with a Nature immersive article.

## Get started

## Get started

Install the dependencies...

```bash
npm install
```

...then start [Rollup](https://rollupjs.org) and serve with [sirv-cli](https://github.com/lukeed/sirv):...then start [Rollup](https://rollupjs.org):

```bash
npm run dev
```

Navigate to [localhost:5000](http://localhost:5000). You should see your app running. Edit a component file in `src`, save it, and reload the page to see your changes.

## To build static files and javascript for publication

```bash
make clean
```

and then

```bash
make all
```

## Get data from Google Docs

Uses [googledoc-to-json](https://github.com/bradoyler/googledoc-to-json) to download text from a google doc in a ArchieML format and convert this to json.

Credentials are stored in `secrets/config.json`.

Use [google-tokens](https://github.com/bradoyler/google-tokens) to create these details.

Note: The `refresh_token` may be invalidated by google after a period of time. Run `google-tokens` again to get new value.

