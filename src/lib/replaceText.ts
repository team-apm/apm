/**
 * Replaces innerText.
 *
 * @param {string} selector - A string of id.
 * @param {string} text - A text to replace.
 */
export default function replaceText(selector: string, text: string) {
  const element = document.getElementById(selector);
  if (element) element.innerText = text;
}
