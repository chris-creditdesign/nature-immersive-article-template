// https://svelte.dev/docs#Server-side_component_API
require("svelte/register");
const { tidy } = require("htmltidy2");
const fs = require("fs");

const data = require("../src/content/content.json");

const tidyOpts = {
  indent: true,
  wrap: 0,
};

// Don't need the default as the js is already bundled
const App = require("../ssr/App.js");

const { html, head } = App.render({
  data,
});

const renderedPage = `
<!DOCTYPE html>
<html lang="en">

<head>
	<meta charset='utf-8'>
	<meta name='viewport' content='width=device-width,initial-scale=1'>
	${head}
	<link rel='stylesheet' href='css/index.css'>
	<link rel='stylesheet' href='build/bundle.css'>
	<script type="module" src='build/main.js'></script>
	<script type="text/javascript" src='js/tracking.js'></script>
</head>

<body class="light">

<div id="statically-rendered-html">
	${html}	
</div>

</body>

</html>
`;

tidy(renderedPage, tidyOpts, (err, tidyHtml) => {
  fs.writeFileSync("./public/index.html", tidyHtml, "utf8");
});
