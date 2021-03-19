(function () {
  'use strict';

  var debounce = function debounce(fn, time) {
    for (var _len = arguments.length, theArgs = new Array(_len > 2 ? _len - 2 : 0), _key = 2; _key < _len; _key++) {
      theArgs[_key - 2] = arguments[_key];
    }

    var timeout;

    function returnFunction() {
      var _this = this;

      var functionCall = function functionCall() {
        return fn.call.apply(fn, [_this].concat(theArgs));
      };

      clearTimeout(timeout);
      timeout = setTimeout(functionCall, time);
    }

    return returnFunction;
  };

  var checkGA = function checkGA() {
    return window.ga && window.ga.create;
  };

  var cache = [];

  var calculateSteps = function calculateSteps(documentHeight) {
    return {
      "25%": parseInt(documentHeight * 0.25, 10),
      "50%": parseInt(documentHeight * 0.5, 10),
      "75%": parseInt(documentHeight * 0.75, 10),
      "100%": documentHeight - 50
    };
  };

  var getDocumentHeight = function getDocumentHeight() {
    return Math.max(document.documentElement.scrollHeight, document.body.scrollHeight, document.documentElement.offsetHeight, document.body.offsetHeight, document.documentElement.clientHeight);
  };

  var getWindowHeight = function getWindowHeight() {
    return window.innerHeight || document.documentElement.clientHeight || document.body.clientHeight;
  };

  var getPageYOffset = function getPageYOffset() {
    return window.pageYOffset || (document.compatMode === "CSS1Compat" ? document.documentElement.scrollTop : document.body.scrollTop);
  };

  var sendEvent = function sendEvent(label) {
    if (!checkGA()) return;
    console.log("ga('send', 'event', 'scroll-depth', 'scrolling', ".concat(label, ")"));
    window.ga("send", "event", {
      eventCategory: "scroll-depth",
      eventAction: "scrolling",
      eventLabel: label,
      nonInteraction: true
    });
  };

  var checkSteps = function checkSteps(steps, scrollDistance) {
    Object.keys(steps).forEach(function (key) {
      var val = steps[key];

      if (!cache.includes(key) && scrollDistance >= val) {
        sendEvent(key);
        cache.push(key);
      }
    });
  };

  var scrollEventHandler = debounce(function () {
    var docHeight = getDocumentHeight();
    var winHeight = getWindowHeight();
    var scrollDistance = getPageYOffset() + winHeight;
    var steps = calculateSteps(docHeight);

    if (cache.length >= 4) {
      window.removeEventListener("scroll", scrollEventHandler, false);
      return;
    }

    checkSteps(steps, scrollDistance);
  }, 500);

  var scrollDepth = function scrollDepth() {
    window.addEventListener("scroll", scrollEventHandler, false);
  };

  var track = function track() {
    var send = function send(data) {
      var gaExists = checkGA();

      if (!gaExists) {
        console.log("ga does not exist");
        return;
      }

      console.log("ga('send', 'event', ".concat(data.eventCategory, ", ").concat(data.eventAction, ", ").concat(data.eventLabel, ");"));
      ga("send", "event", data.eventCategory, data.eventAction, data.eventLabel);
    };

    return {
      send: send
    };
  };

  function init() {
    scrollDepth();

    var _track = track(),
        send = _track.send;

    var sendData = function sendData(event) {
      var dataset = event.target.dataset;
      send(dataset);
    };

    var elemsToTrack = document.querySelectorAll("[data-event-action]");
    elemsToTrack.forEach(function (elem) {
      return elem.addEventListener("click", sendData);
    });
  }

  document.addEventListener("DOMContentLoaded", init);

}());
