import { getCurrentItem } from "./questions.js";

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
// 文本匹配：全等优先 -> 编辑距离相似度兜底
// ============================================================
function levenshteinSimilarity(a, b) {
  const m = a.length;
  const n = b.length;
  const dp = Array.from({ length: m + 1 }, (_, i) => [i]);
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
  }

  const longest = Math.max(m, n);
  return longest ? 1 - dp[m][n] / longest : 1;
}

const SIMILARITY_THRESHOLD = 0.9;
const SIMILARITY_MARGIN = 0.05;

function pickByText(target, candidates) {
  const exact = candidates.find((item) => item.text === target);
  if (exact) return exact;

  const scored = candidates
    .map((item) => ({
      item,
      score: levenshteinSimilarity(target, item.text),
    }))
    .sort((a, b) => b.score - a.score);

  const [best, second] = scored;
  if (!best || best.score < SIMILARITY_THRESHOLD) return null;
  // 两个候选难分高下时宁可不匹配，避免选错
  if (second && best.score - second.score < SIMILARITY_MARGIN) return null;
  return best.item;
}

function findQuestion(db, title) {
  const target = String(title ?? "").trim();
  if (!target) return null;

  const entries = db.questions
    .map((question) => ({
      question,
      text: String(question.question ?? "").trim(),
    }))
    .filter(({ text }) => text);

  return pickByText(target, entries)?.question ?? null;
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

export function searchBank(keyword) {
  const db = getAnswerDB();
  if (!db) return { ok: false, reason: "未配置有效答案 JSON", items: [] };

  const query = String(keyword ?? "").trim().toLowerCase();
  if (!query) return { ok: true, total: 0, items: [] };

  const hits = db.questions.filter((question) =>
    String(question.question ?? "").toLowerCase().includes(query),
  );

  return { ok: true, total: hits.length, items: hits.slice(0, 20) };
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
