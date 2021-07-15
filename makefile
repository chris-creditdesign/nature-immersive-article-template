clean:
	rm public/css/index.css
	rm src/content/articledata.json
	rm public/build/*
	rm ssr/app.js
	rm public/index.html
	echo "All files removed"

all: public/css/index.css src/content/articledata.json public/build/bundle.js ssr/app.js public/index.html
	echo "The app has been made!"

# Combine the css files from nature-immersive-svelte-components into one file
# as a base style for the app
public/css/index.css:
	@[ -d public/css ] || mkdir public/css
	cat node_modules/nature-immersive-svelte-components/static/css/fonts.css \
	node_modules/nature-immersive-svelte-components/static/css/custom-props.css \
	node_modules/nature-immersive-svelte-components/static/css/light-theme.css \
	node_modules/nature-immersive-svelte-components/static/css/index.css \
	> public/css/index.css
	echo "index.css has be made"

# Extract the ArchieML file from google docs containing text for the app
# and convert the data to json
src/content/articledata.json:
	node scripts/get-data-from-google-doc.js
	echo "articledata.json has been made"

# Build the client facing css and js files
public/build/bundle.js: src/content/articledata.json
	rollup -c
	echo "The bundled css and js has been made"

# Build the server side javascript file, used to render the static html file
ssr/app.js: src/content/articledata.json
	rollup -c rollup.config.ssr.js
	echo "app.js has been made"

# Build the static html file which will host the app
public/index.html: src/content/articledata.json ssr/app.js
	node ./scripts/render-static-html.js
	echo "index.html has been made"