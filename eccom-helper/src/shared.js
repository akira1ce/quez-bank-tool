export const CFG = {
  questionSelector: "#ecmc_body_content div > b",
  qnoInput: "#QNo",
  optionRowSelector: "#frmAnswer table tr",
  optionSelector: 'input[name="Answer"]',
  nextBtn: "#btnNext",
  prevBtn: "#btnPrev",
  gotoSelect: "#selQNo",

  pageTimeout: 10000,

  // 题干匹配：全等优先，include 兜底
  questionThreshold: 0.75,
  questionMargin: 0.08,
};

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export function normalize(text) {
  return String(text ?? "")
    .normalize("NFKC")
    .replace(/\s+/g, "")
    .replace(/[，。？！、；：""''（）【】《》,.?!;:"'()\[\]<>·—–\-_]/g, "")
    .replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .toLowerCase();
}

export function similarity(a, b) {
  a = normalize(a);
  b = normalize(b);

  if (!a || !b) return 0;
  if (a === b) return 1;

  if (a.includes(b) || b.includes(a)) {
    const ratio = Math.min(a.length, b.length) / Math.max(a.length, b.length);
    return Math.max(ratio, 0.75);
  }

  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  let curr = new Array(b.length + 1);

  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;

    for (let j = 1; j <= b.length; j++) {
      curr[j] =
        a[i - 1] === b[j - 1]
          ? prev[j - 1]
          : 1 + Math.min(prev[j], curr[j - 1], prev[j - 1]);
    }

    [prev, curr] = [curr, prev];
  }

  return 1 - prev[b.length] / Math.max(a.length, b.length);
}

export function stripPrefix(text) {
  return String(text ?? "")
    .replace(/^\s*[（(]?\s*[A-ZＡ-Ｚa-z]\s*[)）]?\s*[.、)．:：]?\s*/i, "")
    .trim();
}

export function setStatus(message) {
  const el = document.getElementById("as-status");
  if (el) el.textContent = message;
  console.log("[华讯助手]", message);
}
