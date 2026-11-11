import { normalize } from "./shared.js";
import { getCurrentItem, findDomQuestion } from "./questions.js";

const KEY_ANSWERS = "auto_solver_answers_v6";

function getAnswerDB() {
  const raw = GM_getValue(KEY_ANSWERS, "");
  if (!raw) return null;

  try {
    const db = JSON.parse(raw);
    if (!db || !Array.isArray(db.questions)) {
      throw new Error("缺少 questions 数组");
    }
    return db;
  } catch (error) {
    console.error("[Solver] JSON 解析失败:", error);
    return null;
  }
}

// ============================================================
// 题干匹配：全等优先 -> include 兜底
// ============================================================
function findQuestion(db, title) {
  const target = normalize(title);
  if (!target) return null;

  const entries = db.questions
    .filter((question) => question.question)
    .map((question) => ({ question, text: normalize(question.question) }));

  const exact = entries.find(({ text }) => text === target);
  if (exact) return exact.question;

  const included = entries.find(
    ({ text }) => text.includes(target) || target.includes(text),
  );
  return included?.question ?? null;
}

// ============================================================
// 选项匹配：全等优先 -> include 兜底
// ============================================================
function matchOptions(answerTexts, pageOptions) {
  if (!Array.isArray(answerTexts) || !answerTexts.length) return null;

  const used = new Set();
  const options = [];

  for (const answerText of answerTexts) {
    const target = normalize(answerText);
    const pool = pageOptions.filter(
      (option) => !used.has(option) && !option.disabled && option.normalizedText,
    );

    const option =
      pool.find((item) => item.normalizedText === target) ??
      pool.find(
        ({ normalizedText }) =>
          normalizedText.includes(target) || target.includes(normalizedText),
      );

    if (!option) return null;

    used.add(option);
    options.push(option);
  }

  return options;
}

export function getCurrentBankEntry() {
  const item = getCurrentItem();
  if (!item) return { ok: false, reason: "请先点击「获取题目」" };

  const db = getAnswerDB();
  if (!db) {
    return { ok: false, reason: "未配置有效答案 JSON", pageTitle: item.title };
  }

  const question = findQuestion(db, item.title);
  if (!question) {
    return {
      ok: false,
      reason: "答案库中找不到该题干",
      pageTitle: item.title,
    };
  }

  return {
    ok: true,
    qno: question.qno ?? item.qno,
    question: question.question,
    answerTexts: question.answer,
  };
}

export function solveCurrent() {
  const item = getCurrentItem();
  if (!item) return { ok: false, reason: "请先点击「获取题目」" };

  const db = getAnswerDB();
  if (!db) return { ok: false, reason: "未配置有效答案 JSON" };

  const dom = findDomQuestion(item.key);
  if (!dom) return { ok: false, reason: "页面已刷新，请重新获取题目" };
  if (!dom.options.length) return { ok: false, reason: "页面没有可匹配的选项" };

  const question = findQuestion(db, item.title);
  if (!question) return { ok: false, reason: "答案库中找不到该题干" };

  const options = matchOptions(question.answer, dom.options);
  if (!options) return { ok: false, reason: "页面找不到匹配的答案" };

  const matched = new Set(options.map(({ input }) => input));
  for (const option of dom.options) {
    if (!option.disabled && option.input.checked && !matched.has(option.input)) {
      option.input.click();
    }
  }
  for (const { input } of options) {
    if (!input.checked) input.click();
  }

  return { ok: true, count: options.length };
}

export function saveAnswers(raw) {
  const data = JSON.parse(raw);
  if (!Array.isArray(data.questions)) {
    throw new Error("缺少 questions 数组");
  }

  const invalid = data.questions.find(
    (question) => !question || !Array.isArray(question.answer),
  );
  if (invalid) throw new Error("每道题的 answer 都必须是数组");

  GM_setValue(KEY_ANSWERS, JSON.stringify(data));
  return { count: data.questions.length };
}

export function getStoredAnswers() {
  const raw = GM_getValue(KEY_ANSWERS, "");
  if (!raw) return { raw: "", count: 0, invalid: false };
  try {
    const data = JSON.parse(raw);
    if (!Array.isArray(data.questions)) throw new Error("缺少 questions 数组");
    return { raw, count: data.questions.length, invalid: false };
  } catch {
    return { raw, count: 0, invalid: true };
  }
}

export function clearAnswers() {
  GM_setValue(KEY_ANSWERS, "");
}
