let fs = require("fs");
let archieml = require("archieml");

let file = fs.readFileSync("src/content/content.aml", "utf8");
let data = archieml.load(file);

const convertObjectValuesToBooleans = (obj) => {
  const convertedObj = Object.keys(obj).reduce((accumulator, currentKey) => {
    if (obj[currentKey] === "false") {
      accumulator[currentKey] = false;
    } else if (obj[currentKey] === "true") {
      accumulator[currentKey] = true;
    } else {
      accumulator[currentKey] = obj[currentKey];
    }

    return accumulator;
  }, {});

  return convertedObj;
};

let amendedArticleData = convertObjectValuesToBooleans(data.articleData);

let amendedData = Object.assign(data, {
  articleData: amendedArticleData,
});

fs.writeFileSync(
  "src/content/content.json",
  JSON.stringify(amendedData, null, 4)
);
