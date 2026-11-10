export const CFG = {
  questionSelector: "#ecmc_body_content div > b",
  qnoInput: "#QNo",
  optionRowSelector: "#frmAnswer table tr",
  optionSelector: 'input[name="Answer"]',
  nextBtn: "#btnNext",
  prevBtn: "#btnPrev",
  gotoSelect: "#selQNo",

  pageTimeout: 10000,
};

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export function normalize(text) {
  return String(text ?? "")
    .normalize("NFKC")
    .replace(/\s+/g, "")
    .replace(/[，。？！、；：""''（）【】《》,.?!;:"'()\[\]<>·—–\-_]/g, "")
    .toLowerCase();
}

export function setStatus(message) {
  const el = document.getElementById("as-status");
  if (el) el.textContent = message;
  console.log("[华讯助手]", message);
}
