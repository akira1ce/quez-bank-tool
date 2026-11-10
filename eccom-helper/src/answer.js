import { CFG, sleep, normalize, stripPrefix, setStatus } from "./shared.js";

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
      const text = stripPrefix(
        tds.length ? tds[tds.length - 1].innerText : "",
      );

      return [
        {
          input,
          text,
          normalizedText: normalize(text),
          disabled: input.disabled,
          checked: input.checked,
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
// 题目识别：全等优先 -> include 兜底
// ============================================================
function findQuestion(db, page) {
  const target = normalize(page.title);
  if (!target) return { question: null, reason: "未读取到题干" };

  const entries = db.questions
    .filter((q) => q && typeof q.question === "string")
    .map((q) => ({ q, text: normalize(q.question) }))
    .filter((entry) => entry.text);

  if (!entries.length) {
    return { question: null, reason: "答案库没有有效题目" };
  }

  const pick = (list) => {
    const byNo =
      page.qno == null
        ? undefined
        : list.find(({ q }) => Number.parseInt(q.qno, 10) === page.qno);
    return byNo ?? (list.length === 1 ? list[0] : null);
  };

  const exactHits = entries.filter(({ text }) => text === target);
  if (exactHits.length) {
    const hit = pick(exactHits);
    return hit
      ? { question: hit.q, reason: "题干全等" }
      : { question: null, reason: "题干全等有多条，无法按题号区分" };
  }

  const includeHits = entries.filter(
    ({ text }) => text.includes(target) || target.includes(text),
  );
  const hit = pick(includeHits);

  if (!hit) {
    return {
      question: null,
      reason: includeHits.length
        ? "题干部分匹配多条，无法按题号区分"
        : "答案库中找不到该题干",
    };
  }

  return { question: hit.q, reason: "题干包含匹配" };
}

function getAnswerTexts(question) {
  if (!Array.isArray(question.answer)) {
    return { ok: false, texts: [], reason: "answer 必须是数组" };
  }

  const texts = question.answer
    .map((text) => String(text ?? "").trim())
    .filter((text) => normalize(text));

  return texts.length
    ? { ok: true, texts, reason: "" }
    : { ok: false, texts: [], reason: "answer 为空" };
}

// ============================================================
// 选项匹配：全等优先 -> include 兜底
// ============================================================
function matchOptions(answerTexts, pageOptions) {
  const used = new Set();
  const matches = [];

  for (const answerText of answerTexts) {
    const target = normalize(answerText);
    const pool = pageOptions.filter(
      (option) => !used.has(option) && !option.disabled && option.normalizedText,
    );

    let mode = "exact";
    let option = pool.find((item) => item.normalizedText === target);

    if (!option) {
      mode = "include";
      const hits = pool.filter(({ normalizedText }) =>
        normalizedText.includes(target) || target.includes(normalizedText),
      );
      hits.sort(
        (a, b) =>
          Math.abs(a.normalizedText.length - target.length) -
          Math.abs(b.normalizedText.length - target.length),
      );
      option = hits[0];
    }

    if (!option) {
      return { ok: false, matches: [], reason: `页面找不到答案：${answerText}` };
    }

    used.add(option);
    matches.push({ answerText, option, mode });
  }

  return {
    ok: true,
    matches,
    usedInclude: matches.some((match) => match.mode === "include"),
    reason: "匹配成功",
  };
}

function prepareCurrent() {
  const db = getAnswerDB();
  if (!db) return { ok: false, reason: "未配置有效答案 JSON" };

  const page = readPage();
  if (!page.title) return { ok: false, reason: "未读取到题干" };

  const found = findQuestion(db, page);
  if (!found.question) return { ok: false, reason: found.reason };

  const answers = getAnswerTexts(found.question);
  if (!answers.ok) return { ok: false, reason: answers.reason };

  if (!page.options.length) {
    return { ok: false, reason: "页面没有可匹配的选项" };
  }

  const matched = matchOptions(answers.texts, page.options);
  if (!matched.ok) return { ok: false, reason: matched.reason };

  return {
    ok: true,
    page,
    question: found.question,
    matches: matched.matches,
    usedInclude: matched.usedInclude,
  };
}

export function solveCurrent() {
  const result = prepareCurrent();

  if (!result.ok) {
    console.warn("[Solver] 未作答:", result.reason);
    setStatus(`未作答：${result.reason}`);
    return false;
  }

  for (const { option } of result.matches) {
    if (!option.input.checked) {
      option.input.click();
    }
  }

  console.log("[Solver] 题目:", result.page.title);
  console.log("[Solver] 答案库:", result.question.question);
  console.log("[Solver] 匹配:", result.matches);

  const tip = result.usedInclude ? "（含 include 兜底）" : "";
  setStatus(`已选 ${result.matches.length} 项${tip}`);
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

  const found = findQuestion(db, page);
  if (!found.question) return { ok: false, reason: found.reason };

  const answers = getAnswerTexts(found.question);
  if (!answers.ok) return { ok: false, reason: answers.reason };

  return {
    ok: true,
    qno: found.question.qno ?? null,
    question: found.question.question,
    answerTexts: answers.texts,
    matchedBy: found.reason,
  };
}
