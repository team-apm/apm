/**
 * Replaces innerText.
 *
 * @param {string} selector - A string of id.
 * @param {string} text - A text to replace.
 */
function replaceText(selector, text) {
  const element = document.getElementById(selector);
  if (element) element.innerText = text;
}

export default replaceText;
