import {
  CFG,
  sleep,
  normalize,
  similarity,
  stripPrefix,
  setStatus,
} from "./shared.js";

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
// 题目识别：全等优先 -> include/相似度兜底
// ============================================================
function findQuestion(db, page) {
  const pageNorm = normalize(page.title);

  const candidates = db.questions
    .filter((q) => q && typeof q.question === "string" && q.question.trim())
    .map((question) => {
      const qNorm = normalize(question.question);
      return {
        question,
        exact: qNorm === pageNorm,
        score: similarity(question.question, page.title),
      };
    })
    .sort((a, b) => {
      if (a.exact !== b.exact) return a.exact ? -1 : 1;
      return b.score - a.score;
    });

  if (!candidates.length) {
    return { question: null, reason: "答案库没有有效题目", closest: null };
  }

  const exactHits = candidates.filter((item) => item.exact);

  // 题号 + 全等：最强信号
  if (page.qno != null) {
    const byNoExact = exactHits.find(
      (item) => Number(item.question.qno) === page.qno,
    );
    if (byNoExact) {
      return {
        question: byNoExact.question,
        score: 1,
        reason: "题号+题干全等",
      };
    }
  }

  // 题干全等（唯一）
  if (exactHits.length === 1) {
    return {
      question: exactHits[0].question,
      score: 1,
      reason: "题干全等",
    };
  }

  // 题干全等但有多条，用题号消歧
  if (exactHits.length > 1) {
    if (page.qno != null) {
      const byNo = exactHits.find(
        (item) => Number(item.question.qno) === page.qno,
      );
      if (byNo) {
        return {
          question: byNo.question,
          score: 1,
          reason: "题号+题干全等",
        };
      }
    }
    return {
      question: null,
      reason: "题干全等但存在多条，无法可靠区分",
      closest: { title: exactHits[0].question.question, score: 1 },
    };
  }

  // 兜底：题号 + 相似度过阈值
  const best = candidates[0];
  const second = candidates[1];
  const closest = { title: best.question.question, score: best.score };

  if (page.qno != null) {
    const byNo = candidates.find(
      (item) => Number(item.question.qno) === page.qno,
    );
    if (byNo && byNo.score >= CFG.questionThreshold) {
      return {
        question: byNo.question,
        score: byNo.score,
        reason: "题号+相似度",
      };
    }
  }

  if (best.score < CFG.questionThreshold) {
    return {
      question: null,
      reason: `题干相似度不足：${best.score.toFixed(3)}`,
      closest,
    };
  }

  if (second && best.score - second.score < CFG.questionMargin) {
    return {
      question: null,
      reason: "存在多个相似题干，无法可靠区分",
      closest,
    };
  }

  return {
    question: best.question,
    score: best.score,
    reason: "题干相似度",
  };
}

function getAnswerTexts(question) {
  if (!Array.isArray(question.answer)) {
    return { ok: false, texts: [], reason: "answer 必须是数组" };
  }
  if (question.answer.length === 0) {
    return { ok: false, texts: [], reason: "answer 数组为空" };
  }
  if (
    !question.answer.every(
      (item) => typeof item === "string" && normalize(item),
    )
  ) {
    return { ok: false, texts: [], reason: "answer 必须全部是非空字符串" };
  }

  const texts = question.answer.map((item) => item.trim());
  const normalized = texts.map(normalize);

  if (new Set(normalized).size !== normalized.length) {
    return { ok: false, texts: [], reason: "answer 存在重复答案" };
  }

  return { ok: true, texts, reason: "" };
}

// ============================================================
// 选项匹配：全等优先 -> include 兜底
// ============================================================
function matchAnswerToOption(answerText, pageOptions, used) {
  const target = normalize(answerText);

  if (!target) {
    return { ok: false, reason: `答案为空：${answerText}` };
  }

  const pool = pageOptions.filter(
    (option) => !used.has(option) && !option.disabled && option.normalizedText,
  );

  // 1) 规范化全等
  const exactHits = pool.filter((option) => option.normalizedText === target);
  if (exactHits.length === 1) {
    return { ok: true, option: exactHits[0], mode: "exact" };
  }
  if (exactHits.length > 1) {
    // 全等多条理论上不该出现，取第一条并给出提示
    return { ok: true, option: exactHits[0], mode: "exact-multi" };
  }

  // 2) include 兜底
  const includeHits = pool.filter((option) => {
    const t = option.normalizedText;
    return t.includes(target) || target.includes(t);
  });

  if (includeHits.length === 0) {
    return { ok: false, reason: `页面找不到答案：${answerText}` };
  }

  includeHits.sort(
    (a, b) =>
      Math.abs(a.normalizedText.length - target.length) -
      Math.abs(b.normalizedText.length - target.length),
  );

  return { ok: true, option: includeHits[0], mode: "include" };
}

function matchOptions(answerTexts, pageOptions) {
  const matches = [];
  const used = new Set();
  let usedInclude = false;

  for (const answerText of answerTexts) {
    const result = matchAnswerToOption(answerText, pageOptions, used);
    if (!result.ok) {
      return { ok: false, matches: [], reason: result.reason };
    }
    if (result.mode !== "exact") usedInclude = true;
    used.add(result.option);
    matches.push({ answerText, option: result.option, mode: result.mode });
  }

  return { ok: true, matches, usedInclude, reason: "匹配成功" };
}

function prepareCurrent() {
  const db = getAnswerDB();
  if (!db) return { ok: false, reason: "未配置有效答案 JSON" };

  const page = readPage();
  if (!page.title) return { ok: false, reason: "未读取到题干" };

  const found = findQuestion(db, page);
  if (!found.question) {
    return { ok: false, reason: found.reason, closest: found.closest };
  }

  const question = found.question;
  const answers = getAnswerTexts(question);
  if (!answers.ok) return { ok: false, reason: answers.reason };

  if (!page.options.length) {
    return { ok: false, reason: "页面没有可匹配的选项" };
  }

  const matched = matchOptions(answers.texts, page.options);
  if (!matched.ok) return { ok: false, reason: matched.reason };

  return {
    ok: true,
    page,
    question,
    answerTexts: answers.texts,
    matches: matched.matches,
    usedInclude: matched.usedInclude,
    matchReason: found.reason,
  };
}

export function solveCurrent() {
  const result = prepareCurrent();

  if (!result.ok) {
    const closest = result.closest;
    const tip = closest
      ? `\n最接近：${closest.title}\n相似度：${closest.score.toFixed(3)}`
      : "";
    console.warn("[Solver] 未作答:", result.reason, result);
    setStatus(`未作答：${result.reason}${tip}`);
    return false;
  }

  for (const match of result.matches) {
    if (!match.option.input.checked) {
      match.option.input.click();
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

  const letterOnly = data.questions.filter(
    (q) =>
      Array.isArray(q.answer) &&
      q.answer.length > 0 &&
      q.answer.every((a) => /^[A-Z]$/i.test(String(a).trim())),
  );
  if (letterOnly.length) {
    console.warn(
      "[Solver] 以下题目 answer 疑似字母：",
      letterOnly.map((q) => q.qno),
    );
  }

  GM_setValue(KEY_ANSWERS, JSON.stringify(data));
  return { count: data.questions.length, letterOnly: letterOnly.length };
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
  if (!found.question) {
    return { ok: false, reason: found.reason, closest: found.closest };
  }

  const question = found.question;
  const answers = getAnswerTexts(question);
  if (!answers.ok) return { ok: false, reason: answers.reason };

  return {
    ok: true,
    qno: question.qno ?? null,
    question: question.question,
    answerTexts: answers.texts,
    score: found.score,
    matchedBy: found.reason,
  };
}
