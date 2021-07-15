const fs = require("fs");
const GoogleDocToJSON = require("googledoc-to-json");
const config = require("../secrets/config.json");

const gDocToJSON = new GoogleDocToJSON(config);

const options = {
  fileId: "1kJEU8O6DyYcHxyyaU2aLqRursw0W0tZLFZhOKFKxd8M",
  oAuthTokens: config.oAuthTokens,
};

gDocToJSON.getArchieML(options, (err, data) => {
  if (err) {
    console.log(err);
  }

  fs.writeFileSync(
    "./src/content/articledata.json",
    JSON.stringify(data),
    "utf8"
  );
});