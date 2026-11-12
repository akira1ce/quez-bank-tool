import { readPageQuestions } from "./platforms.js";

let items = [];
let index = -1;

export function fetchQuestions() {
  const { questions } = readPageQuestions();
  let added = 0;

  for (const question of questions) {
    const key = question.title;
    if (!key || items.some((item) => item.key === key)) continue;

    items.push({ key, title: question.title, qno: question.qno });
    added += 1;
  }

  // 当前项不在本页时（例如页面换了题），切换到本页识别到的第一题
  const pageKeys = questions.map((question) => question.title);
  if (!items[index] || !pageKeys.includes(items[index].key)) {
    const nextIndex = items.findIndex((item) => pageKeys.includes(item.key));
    if (nextIndex >= 0) index = nextIndex;
  }
  if (index < 0 && items.length) index = 0;

  return { found: questions.length, added, total: items.length };
}

export function getCurrentItem() {
  return items[index] ?? null;
}

export function getPosition() {
  return { index, total: items.length };
}

export function moveCurrent(delta) {
  const next = index + delta;
  if (next < 0 || next >= items.length) return null;

  index = next;
  return items[index];
}

// 页面可能重绘或刷新，答题前按题干文本重新定位当前题目
export function findDomQuestion(key) {
  const { questions } = readPageQuestions();
  return questions.find((question) => question.title === key) ?? null;
}

export function focusItem(item) {
  const dom = findDomQuestion(item.key);
  dom?.scope.scrollIntoView?.({ block: "center", behavior: "smooth" });
  return dom;
}
