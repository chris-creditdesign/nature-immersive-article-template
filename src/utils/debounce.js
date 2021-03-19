/**
 * Used for applying repeating functions 'fn' with ..theArgs as arguments
 * at a limited rate - maximum oncqe per 'time' interval.
 *
 * The rest parameter syntax allows us to represent an indefinite
 * number of arguments, theArgs, as an array.
 * https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Functions/rest_parameters
 *
 * @param {function} fn The function to be called
 * @param {number} time The delay in milliseconds
 * @param  {array} theArgs The arguments to apply to the funciton
 *
 * @return {function} returnFunction
 */

const debounce = (fn, time, ...theArgs) => {
  let timeout;

  function returnFunction() {
    const functionCall = () => fn.call(this, ...theArgs);

    clearTimeout(timeout);
    timeout = setTimeout(functionCall, time);
  }

  return returnFunction;
};

export default debounce;
