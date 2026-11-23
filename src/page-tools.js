export function clickRadiosInCells() {
  const radios = [...document.querySelectorAll("td")]
    .map((td) => td.querySelector('input[type="radio"]'))
    .filter((radio) => radio && !radio.disabled);

  radios.forEach((radio) => radio.click());
  return radios.length;
}

const RESTART_INTERVAL = 30_000;
let restartTimer = null;

function clickRestartStudy() {
  const button = document.getElementById("reStartStudy");
  if (!button) return false;

  button.dispatchEvent(
    new MouseEvent("mousedown", { bubbles: true, cancelable: true }),
  );
  button.click();
  return true;
}

export function isRestartWatching() {
  return restartTimer !== null;
}

export function setRestartWatching(on, onClick) {
  if (on === isRestartWatching()) return;

  if (!on) {
    clearInterval(restartTimer);
    restartTimer = null;
    return;
  }

  const tick = () => {
    if (clickRestartStudy()) onClick?.();
  };

  tick();
  restartTimer = setInterval(tick, RESTART_INTERVAL);
}
