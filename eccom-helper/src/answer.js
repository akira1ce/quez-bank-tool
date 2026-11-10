import { CFG, sleep, normalize, setStatus } from "./shared.js";

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

export function readPage() {
  const qnoEl = document.querySelector(CFG.qnoInput);
  const titleEl = document.querySelector(CFG.questionSelector);

  const parsedQno = qnoEl ? Number.parseInt(qnoEl.value, 10) : NaN;

  const options = [...document.querySelectorAll(CFG.optionRowSelector)].flatMap(
    (row) => {
      const input = row.querySelector(CFG.optionSelector);
      if (!input) return [];

      const tds = row.querySelectorAll("td");
      const text = tds.length ? tds[tds.length - 1].innerText : "";

      return [
        {
          input,
          normalizedText: normalize(text),
          disabled: input.disabled,
        },
      ];
    },
  );

  return {
    qno: Number.isFinite(parsedQno) ? parsedQno : null,
    title: titleEl?.innerText.trim() || "",
    options,
  };
}

// ============================================================
// 题干匹配：全等优先 -> include 兜底
// ============================================================
function findQuestion(db, page) {
  const target = normalize(page.title);
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

function prepareCurrent() {
  const db = getAnswerDB();
  if (!db) return { ok: false, reason: "未配置有效答案 JSON" };

  const page = readPage();
  if (!page.title) return { ok: false, reason: "未读取到题干" };

  const question = findQuestion(db, page);
  if (!question) return { ok: false, reason: "答案库中找不到该题干" };

  if (!page.options.length) {
    return { ok: false, reason: "页面没有可匹配的选项" };
  }

  const options = matchOptions(question.answer, page.options);
  if (!options) return { ok: false, reason: "页面找不到匹配的答案" };

  return { ok: true, page, question, options };
}

export function solveCurrent() {
  const result = prepareCurrent();

  if (!result.ok) {
    console.warn("[Solver] 未作答:", result.reason);
    setStatus(`未作答：${result.reason}`);
    return false;
  }

  for (const { input } of result.options) {
    if (!input.checked) {
      input.click();
    }
  }

  console.log("[Solver] 题目:", result.page.title);
  console.log("[Solver] 答案库:", result.question.question);
  console.log("[Solver] 匹配:", result.options);

  setStatus(`已选 ${result.options.length} 项`);
  return true;
}

export function goNext() {
  const button = document.querySelector(CFG.nextBtn);
  if (button && !button.disabled) {
    button.click();
    return true;
  }

  const page = readPage();
  const select = document.querySelector(CFG.gotoSelect);
  if (!select || page.qno == null) return false;

  const next = page.qno + 1;
  const option = [...select.options].find(
    (item) => Number(item.value) === next,
  );
  if (!option) return false;

  select.value = option.value;
  select.dispatchEvent(new Event("change", { bubbles: true }));
  return true;
}

export function goPrev() {
  const button = document.querySelector(CFG.prevBtn);
  if (button && !button.disabled) {
    button.click();
    return true;
  }

  const page = readPage();
  const select = document.querySelector(CFG.gotoSelect);
  if (!select || page.qno == null) return false;

  const prev = page.qno - 1;
  const option = [...select.options].find(
    (item) => Number(item.value) === prev,
  );
  if (!option) return false;

  select.value = option.value;
  select.dispatchEvent(new Event("change", { bubbles: true }));
  return true;
}

export async function waitForPageChange(oldTitle, oldQno) {
  const start = Date.now();
  while (Date.now() - start < CFG.pageTimeout) {
    await sleep(200);
    const page = readPage();
    if (!page.title) continue;
    const titleChanged = normalize(page.title) !== normalize(oldTitle);
    const qnoChanged =
      page.qno != null && oldQno != null && page.qno !== oldQno;
    if (titleChanged || qnoChanged) return true;
  }
  return false;
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

export function getCurrentBankEntry() {
  const db = getAnswerDB();
  if (!db) return { ok: false, reason: "未配置有效答案 JSON" };

  const page = readPage();
  if (!page.title) return { ok: false, reason: "未读取到题干" };

  const question = findQuestion(db, page);
  if (!question) return { ok: false, reason: "答案库中找不到该题干" };

  return {
    ok: true,
    qno: question.qno ?? null,
    question: question.question,
    answerTexts: question.answer,
  };
}
