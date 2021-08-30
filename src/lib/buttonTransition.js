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

module.exports = {
  /**
   * Show loading spinner in the button.
   *
   * @param {HTMLButtonElement} btn - An element of the button to be
   * @returns {Function} Returns a function to enable the button.
   */
  loading: function (btn) {
    btn.disabled = true;
    const beforeHTML = btn.innerHTML;
    btn.innerHTML =
      '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>' +
      '<span class="visually-hidden">Loading...</span>';

    return function () {
      btn.innerHTML = beforeHTML;
      btn.disabled = false;
    };
  },

  /**
   * Show a success message in the button.
   *
   * @param {HTMLButtonElement} btn - An element of the button to be
   * @param {string} message - A message to be shown
   */
  success: function (btn, message) {
    for (const type of buttonTypes) {
      if (btn.classList.contains('btn-' + type)) {
        btn.classList.replace('btn-' + type, 'btn-success');
        setTimeout(() => {
          btn.classList.replace('btn-success', 'btn-' + type);
        }, 3000);
        break;
      }

      if (btn.classList.contains('btn-outline-' + type)) {
        btn.classList.replace('btn-outline-' + type, 'btn-outline-success');
        setTimeout(() => {
          btn.classList.replace('btn-outline-success', 'btn-outline-' + type);
        }, 3000);
        break;
      }
    }

    btn.innerHTML = message;
  },

  /**
   * Show a error message in the button.
   *
   * @param {HTMLButtonElement} btn - An element of the button to be
   * @param {string} message - A message to be shown
   */
  error: function (btn, message) {
    for (const type of buttonTypes) {
      if (btn.classList.contains('btn-' + type)) {
        btn.classList.replace('btn-' + type, 'btn-danger');
        setTimeout(() => {
          btn.classList.replace('btn-danger', 'btn-' + type);
        }, 3000);
        break;
      }

      if (btn.classList.contains('btn-outline-' + type)) {
        btn.classList.replace('btn-outline-' + type, 'btn-outline-danger');
        setTimeout(() => {
          btn.classList.replace('btn-outline-danger', 'btn-outline-' + type);
        }, 3000);
        break;
      }
    }

    btn.innerHTML = message;
  },
};
