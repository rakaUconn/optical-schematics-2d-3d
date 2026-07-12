/** Wires a small toast/snackbar element; returns a toast(message) function. */
export function createToast(el) {
  let timer;
  return function toast(message) {
    el.textContent = message;
    el.classList.add('show');
    clearTimeout(timer);
    timer = setTimeout(() => el.classList.remove('show'), 2000);
  };
}
