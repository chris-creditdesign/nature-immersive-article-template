import scrollDepth from "./utils/scroll-depth.js";
import track from "./utils/track.js";

function init() {
  /* -------------------------------- Tracking -------------------------------- */
  scrollDepth();
  // Set up the link tracking
  const { send } = track();
  const sendData = (event) => {
    const { dataset } = event.target;
    send(dataset);
  };
  const elemsToTrack = document.querySelectorAll("[data-event-action]");
  elemsToTrack.forEach((elem) => elem.addEventListener("click", sendData));
}

document.addEventListener("DOMContentLoaded", init);
