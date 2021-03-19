/* eslint-disable no-console */
import debounce from "./debounce.js";
import checkGA from "./checkGa.js";

const cache = [];

const calculateSteps = (documentHeight) => ({
  "25%": parseInt(documentHeight * 0.25, 10),
  "50%": parseInt(documentHeight * 0.5, 10),
  "75%": parseInt(documentHeight * 0.75, 10),
  "100%": documentHeight - 50,
});

const getDocumentHeight = () =>
  Math.max(
    document.documentElement.scrollHeight,
    document.body.scrollHeight,
    document.documentElement.offsetHeight,
    document.body.offsetHeight,
    document.documentElement.clientHeight
  );

const getWindowHeight = () =>
  window.innerHeight ||
  document.documentElement.clientHeight ||
  document.body.clientHeight;

const getPageYOffset = () =>
  window.pageYOffset ||
  (document.compatMode === "CSS1Compat"
    ? document.documentElement.scrollTop
    : document.body.scrollTop);

const sendEvent = (label) => {
  if (!checkGA()) return;

  console.log(`ga('send', 'event', 'scroll-depth', 'scrolling', ${label})`);
  window.ga("send", "event", {
    eventCategory: "scroll-depth",
    eventAction: "scrolling",
    eventLabel: label,
    nonInteraction: true,
  });
};

const checkSteps = (steps, scrollDistance) => {
  Object.keys(steps).forEach((key) => {
    const val = steps[key];

    if (!cache.includes(key) && scrollDistance >= val) {
      sendEvent(key);
      cache.push(key);
    }
  });
};

const scrollEventHandler = debounce(() => {
  const docHeight = getDocumentHeight();
  const winHeight = getWindowHeight();
  const scrollDistance = getPageYOffset() + winHeight;
  const steps = calculateSteps(docHeight);

  if (cache.length >= 4) {
    window.removeEventListener("scroll", scrollEventHandler, false);
    return;
  }

  checkSteps(steps, scrollDistance);
}, 500);

const scrollDepth = () => {
  window.addEventListener("scroll", scrollEventHandler, false);
};

export default scrollDepth;
