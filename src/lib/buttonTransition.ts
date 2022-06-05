const buttonTypes = [
  'primary',
  'secondary',
  'success',
  'danger',
  'warning',
  'info',
  'light',
  'dark',
  'link',
];

/**
 * Show loading spinner in the button.
 *
 * @param {HTMLButtonElement} btn - An element of the button to be
 * @param {string} [message] - A message to show.
 * @returns {Function} Returns a function to enable the button.
 */
function loading(btn, message) {
  btn.disabled = true;
  const beforeHTML = btn.innerHTML;
  btn.innerHTML =
    '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>' +
    '<span class="visually-hidden">Loading...</span>';

  return function () {
    btn.innerHTML = message ?? beforeHTML;
    btn.disabled = false;
  };
}

/**
 * Show a message in the button.
 *
 * @param {HTMLButtonElement} btn - An element of the button to be changed
 * @param {string} message - A message to be shown
 * @param {string} type - A type of the button to be changed to
 */
function message(btn, message, type = null) {
  if (type != null) {
    for (const originalType of buttonTypes) {
      const btnOriginalType = 'btn-' + originalType;
      const btnType = 'btn-' + type;
      if (btn.classList.contains(btnOriginalType)) {
        btn.classList.replace(btnOriginalType, btnType);
        setTimeout(() => {
          btn.classList.replace(btnType, btnOriginalType);
        }, 3000);
        break;
      }

      const outlineOriginalType = 'btn-outline-' + originalType;
      const outlineType = 'btn-outline-' + type;
      if (btn.classList.contains(outlineOriginalType)) {
        btn.classList.replace(outlineOriginalType, outlineType);
        setTimeout(() => {
          btn.classList.replace(outlineType, outlineOriginalType);
        }, 3000);
        break;
      }
    }
  }

  btn.innerText = message;
}

const buttonTransition = { loading, message };
export default buttonTransition;
