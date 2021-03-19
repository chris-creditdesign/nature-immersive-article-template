/* eslint-disable no-console */
import checkGA from "./checkGa.js";

const track = () => {
  const send = (data) => {
    const gaExists = checkGA();

    if (!gaExists) {
      console.log("ga does not exist");
      return;
    }

    console.log(
      `ga('send', 'event', ${data.eventCategory}, ${data.eventAction}, ${data.eventLabel});`
    );

    // eslint-disable-next-line no-undef
    ga("send", "event", data.eventCategory, data.eventAction, data.eventLabel);
  };

  return {
    send,
  };
};

export default track;
