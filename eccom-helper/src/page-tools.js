export function clickRadiosInCells() {
  const radios = [...document.querySelectorAll("td")]
    .map((td) => td.querySelector('input[type="radio"]'))
    .filter((radio) => radio && !radio.disabled);

  radios.forEach((radio) => radio.click());
  return radios.length;
}
