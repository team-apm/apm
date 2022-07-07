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
 * @returns {{enableButton:()=>void}} Returns a function to enable the button.
 */
export function loading(btn: HTMLButtonElement, message?: string) {
  btn.disabled = true;
  const beforeHTML = btn.innerHTML;
  btn.innerHTML =
    '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>' +
    '<span class="visually-hidden">Loading...</span>';

  return {
    enableButton: function () {
      btn.innerHTML = message ?? beforeHTML;
      btn.disabled = false;
    },
  };
}

/**
 * Show a message in the button.
 *
 * @param {HTMLButtonElement} btn - An element of the button to be changed
 * @param {string} message - A message to be shown
 * @param {string} type - A type of the button to be changed to
 */
export function message(
  btn: HTMLButtonElement,
  message: string,
  type: string = null
) {
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
