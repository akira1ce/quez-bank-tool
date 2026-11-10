// ==UserScript==
// @name         华讯助手
// @namespace    http://tampermonkey.net/
// @version      7.5
// @description  统一答案数组，全等优先 include 兜底匹配；紧凑工具型 UI；JSON 输入区可折叠；支持从考试结果页导入答对题目
// @match        *://internal.eccom.com.cn/*
// @grant        GM_setValue
// @grant        GM_getValue
// @run-at       document-idle
// ==/UserScript==
(() => {
  // eccom-helper/src/panel.css
  var panel_default = '#auto-solver-box {\n  position: fixed; top: 12px; right: 12px; z-index: 999999;\n  width: 320px;\n  background: #ffffff; color: #1f2937;\n  border: 1px solid #e5e7eb; border-radius: 10px;\n  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.12);\n  padding: 10px;\n  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;\n  font-size: 13px; line-height: 1.45;\n}\n#auto-solver-box, #auto-solver-box * { box-sizing: border-box; }\n#auto-solver-box button {\n  all: unset;\n  box-sizing: border-box;\n  display: inline-flex; align-items: center; justify-content: center;\n  min-height: 30px; padding: 0 10px;\n  border: 1px solid #d1d5db; border-radius: 7px;\n  background: #ffffff; color: #1f2937;\n  font: 500 12.5px/1 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;\n  cursor: pointer; text-align: center;\n  transition: background .15s, border-color .15s, color .15s;\n}\n#auto-solver-box button:hover { background: #f3f4f6; }\n#auto-solver-box button:active { background: #e5e7eb; }\n#auto-solver-box button.as-primary {\n  background: #2563eb; border-color: #2563eb; color: #ffffff;\n}\n#auto-solver-box button.as-primary:hover { background: #1d4ed8; border-color: #1d4ed8; }\n\n.as-topbar { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }\n.as-seg { display: inline-flex; padding: 2px; background: #f3f4f6; border-radius: 8px; gap: 2px; }\n.as-seg-btn { min-height: 26px !important; padding: 0 14px !important; border: 0 !important; background: transparent !important; color: #6b7280 !important; border-radius: 6px !important; font-weight: 500 !important; }\n.as-seg-btn:hover { color: #1f2937 !important; }\n.as-seg-btn.is-active { background: #ffffff !important; color: #111827 !important; box-shadow: 0 1px 2px rgba(0,0,0,.08); }\n.as-hint { font: 11px/1 ui-monospace, SFMono-Regular, Menlo, monospace; color: #9ca3af; padding: 3px 6px; border: 1px solid #e5e7eb; border-radius: 5px; }\n\n.as-card {\n  border: 1px solid #e5e7eb; border-radius: 8px;\n  padding: 10px 12px; margin-bottom: 10px;\n  background: #fafbfc;\n}\n.as-card-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px; }\n.as-card-tag { font-size: 11px; font-weight: 600; color: #6b7280; letter-spacing: .04em; text-transform: uppercase; }\n.as-card-state { font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 999px; }\n.as-state-hit { color: #047857; background: #ecfdf5; }\n.as-state-miss { color: #b45309; background: #fffbeb; }\n.as-card-question { font-size: 13px; color: #111827; margin-bottom: 8px; white-space: pre-wrap; word-break: break-word; }\n.as-card-answers { margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 4px; }\n.as-card-answers li {\n  font-size: 12.5px; color: #065f46; background: #ecfdf5;\n  border: 1px solid #d1fae5; border-radius: 6px;\n  padding: 5px 8px; white-space: pre-wrap; word-break: break-word;\n}\n.as-card-meta { font-size: 11px; color: #9ca3af; margin-top: 6px; }\n.as-card-reason { font-size: 12.5px; color: #b45309; white-space: pre-wrap; word-break: break-word; }\n.as-card-sub { font-size: 11.5px; color: #6b7280; margin-top: 6px; }\n\n.as-actions { display: grid; grid-template-columns: 1fr 1.2fr 1fr; gap: 6px; margin-bottom: 10px; }\n.as-actions button { width: 100%; }\n\n.as-disclosure {\n  all: unset;\n  box-sizing: border-box;\n  display: flex; align-items: center; gap: 6px; width: 100%;\n  padding: 7px 10px; margin-bottom: 8px;\n  border: 1px dashed #d1d5db; border-radius: 7px;\n  color: #4b5563; font-size: 12.5px; cursor: pointer;\n  background: #ffffff;\n}\n.as-disclosure:hover { background: #f9fafb; }\n.as-caret { display: inline-block; width: 12px; color: #9ca3af; transition: transform .15s; }\n.as-disclosure.is-open .as-caret { transform: rotate(90deg); }\n.as-count { margin-left: auto; font-size: 11px; color: #6b7280; }\n\n.as-json-wrap { margin-bottom: 10px; }\n.as-json-wrap textarea {\n  display: block; width: 100%; height: 120px; min-height: 120px;\n  padding: 8px; border: 1px solid #d1d5db; border-radius: 7px;\n  background: #ffffff; color: #111827;\n  font: 12px/1.45 ui-monospace, SFMono-Regular, Menlo, monospace;\n  resize: vertical; outline: none;\n  margin-top: 8px;\n}\n.as-json-wrap textarea:focus { border-color: #2563eb; box-shadow: 0 0 0 3px rgba(37, 99, 235, .12); }\n.as-json-actions { display: grid; grid-template-columns: repeat(2, 1fr); gap: 6px; margin-top: 6px; }\n.as-json-actions button { width: 100%; }\n\n.as-status {\n  font-size: 12px; color: #6b7280;\n  min-height: 16px; max-height: 140px; overflow-y: auto;\n  white-space: pre-wrap; word-break: break-word;\n  padding: 6px 8px; background: #f9fafb; border-radius: 6px;\n  border: 1px solid #f3f4f6;\n  margin-top: 8px;\n}\n\n.as-tools-note { font-size: 11.5px; color: #9ca3af; margin-top: 6px; }\n\n#as-page-tools button { width: 100%; }\n\n@media (max-width: 640px) {\n  #auto-solver-box { width: calc(100vw - 24px); right: 12px; left: 12px; }\n}\n';

  // eccom-helper/src/shared.js
  var CFG = {
    questionSelector: "#ecmc_body_content div > b",
    qnoInput: "#QNo",
    optionRowSelector: "#frmAnswer table tr",
    optionSelector: 'input[name="Answer"]',
    nextBtn: "#btnNext",
    prevBtn: "#btnPrev",
    gotoSelect: "#selQNo",
    pageTimeout: 1e4,
    // 题干匹配：全等优先，include 兜底
    questionThreshold: 0.75,
    questionMargin: 0.08
  };
  var sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  function normalize(text) {
    return String(text ?? "").normalize("NFKC").replace(/\s+/g, "").replace(/[，。？！、；：""''（）【】《》,.?!;:"'()\[\]<>·—–\-_]/g, "").replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 65248)).toLowerCase();
  }
  function similarity(a, b) {
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
        curr[j] = a[i - 1] === b[j - 1] ? prev[j - 1] : 1 + Math.min(prev[j], curr[j - 1], prev[j - 1]);
      }
      [prev, curr] = [curr, prev];
    }
    return 1 - prev[b.length] / Math.max(a.length, b.length);
  }
  function stripPrefix(text) {
    return String(text ?? "").replace(/^\s*[（(]?\s*[A-ZＡ-Ｚa-z]\s*[)）]?\s*[.、)．:：]?\s*/i, "").trim();
  }
  function setStatus(message) {
    const el = document.getElementById("as-status");
    if (el) el.textContent = message;
    console.log("[华讯助手]", message);
  }

  // eccom-helper/src/page-tools.js
  function clickRadiosInCells() {
    const radios = [...document.querySelectorAll("td")].map((td) => td.querySelector('input[type="radio"]')).filter((radio) => radio && !radio.disabled);
    radios.forEach((radio) => radio.click());
    return radios.length;
  }

  // eccom-helper/src/exam-result.js
  var TABLE_SELECTOR = "table.table-dataList.table-grid, table.table-dataList";
  var LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  function clean(text) {
    return String(text ?? "").replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
  }
  function parseQuestionCell(cell) {
    const html = cell.innerHTML || "";
    const parts = html.split(/<br\s*\/?>/i).map((s) => {
      const div = document.createElement("div");
      div.innerHTML = s;
      return clean(div.textContent);
    }).filter(Boolean);
    if (!parts.length) return { question: "", options: [] };
    const optionLineIndex = parts.findIndex((p) => /\[A\]/i.test(p));
    const questionParts = optionLineIndex === -1 ? parts : parts.slice(0, optionLineIndex);
    const optionLine = optionLineIndex === -1 ? "" : parts[optionLineIndex];
    const question = clean(questionParts.join(" "));
    const options = [];
    if (optionLine) {
      const regex = /\[([A-Z])\]\s*([\s\S]*?)(?=\s*\[[A-Z]\]|$)/gi;
      let m;
      while ((m = regex.exec(optionLine)) !== null) {
        const letter = m[1].toUpperCase();
        const text = clean(m[2]);
        if (text) options.push({ letter, text });
      }
    }
    return { question, options };
  }
  function parseAnswerLetters(raw) {
    const text = String(raw ?? "").toUpperCase();
    const letters = [];
    for (const ch of text) {
      if (LETTERS.includes(ch) && !letters.includes(ch)) letters.push(ch);
    }
    return letters;
  }
  function parseNumber(text) {
    const n = Number.parseFloat(String(text ?? "").replace(/[^\d.-]/g, ""));
    return Number.isFinite(n) ? n : null;
  }
  function collectExamResult() {
    const table = document.querySelector(TABLE_SELECTOR);
    if (!table) {
      return { ok: false, reason: "当前页面没有找到考试结果表格" };
    }
    const rows = [...table.querySelectorAll("tbody > tr")];
    const questions = [];
    let skippedWrong = 0;
    let skippedInvalid = 0;
    for (const row of rows) {
      if (row.querySelector("th")) continue;
      const cells = [...row.children];
      if (cells.length < 6) continue;
      const qnoText = clean(cells[0].textContent);
      const qno = Number.parseInt(qnoText.replace(/[^\d]/g, ""), 10);
      if (!Number.isFinite(qno)) continue;
      const typeText = clean(cells[1].textContent);
      const questionCell = cells[2];
      const scoreFull = parseNumber(cells[3].textContent);
      const answerRaw = cells[4].textContent;
      const scoreGot = parseNumber(cells[5].textContent);
      if (scoreFull == null || scoreGot == null || Math.abs(scoreFull - scoreGot) > 1e-6) {
        skippedWrong += 1;
        continue;
      }
      const { question, options } = parseQuestionCell(questionCell);
      if (!question || !options.length) {
        skippedInvalid += 1;
        continue;
      }
      const letters = parseAnswerLetters(answerRaw);
      const rawAnswer = clean(answerRaw);
      const isJudge = /判断/.test(typeText) || options.length === 2 && options.every(
        (o) => /^(正确|错误|对|错|是|否|True|False)$/i.test(o.text)
      );
      let answer = [];
      if (isJudge) {
        const opt = options.find((o) => o.letter === letters[0]) || options.find((o) => clean(o.text) === rawAnswer) || options[0];
        answer = [opt.text];
      } else if (letters.length) {
        const byLetter = new Map(options.map((o) => [o.letter, o.text]));
        answer = letters.map((l) => byLetter.get(l)).filter(Boolean);
      } else {
        const textHit = options.find((o) => clean(o.text) === rawAnswer);
        if (textHit) answer = [textHit.text];
      }
      if (!answer.length) {
        skippedInvalid += 1;
        continue;
      }
      questions.push({ qno, question, answer });
    }
    if (!questions.length) {
      return {
        ok: false,
        reason: `没有收集到答对的题目（错题 ${skippedWrong}，格式异常 ${skippedInvalid}）`
      };
    }
    return {
      ok: true,
      data: { questions },
      total: rows.length,
      kept: questions.length,
      skippedWrong,
      skippedInvalid
    };
  }

  // eccom-helper/src/answer.js
  var KEY_ANSWERS = "auto_solver_answers_v6";
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
  function readPage() {
    const qnoEl = document.querySelector(CFG.qnoInput);
    const titleEl = document.querySelector(CFG.questionSelector);
    const parsedQno = qnoEl ? Number.parseInt(qnoEl.value, 10) : NaN;
    const options = [...document.querySelectorAll(CFG.optionRowSelector)].flatMap(
      (row) => {
        const input = row.querySelector(CFG.optionSelector);
        if (!input) return [];
        const tds = row.querySelectorAll("td");
        const text = stripPrefix(
          tds.length ? tds[tds.length - 1].innerText : ""
        );
        return [
          {
            input,
            text,
            normalizedText: normalize(text),
            disabled: input.disabled,
            checked: input.checked
          }
        ];
      }
    );
    return {
      qno: Number.isFinite(parsedQno) ? parsedQno : null,
      title: titleEl?.innerText.trim() || "",
      options
    };
  }
  function findQuestion(db, page) {
    const pageNorm = normalize(page.title);
    const candidates = db.questions.filter((q) => q && typeof q.question === "string" && q.question.trim()).map((question) => {
      const qNorm = normalize(question.question);
      return {
        question,
        exact: qNorm === pageNorm,
        score: similarity(question.question, page.title)
      };
    }).sort((a, b) => {
      if (a.exact !== b.exact) return a.exact ? -1 : 1;
      return b.score - a.score;
    });
    if (!candidates.length) {
      return { question: null, reason: "答案库没有有效题目", closest: null };
    }
    const exactHits = candidates.filter((item) => item.exact);
    if (page.qno != null) {
      const byNoExact = exactHits.find(
        (item) => Number(item.question.qno) === page.qno
      );
      if (byNoExact) {
        return {
          question: byNoExact.question,
          score: 1,
          reason: "题号+题干全等"
        };
      }
    }
    if (exactHits.length === 1) {
      return {
        question: exactHits[0].question,
        score: 1,
        reason: "题干全等"
      };
    }
    if (exactHits.length > 1) {
      if (page.qno != null) {
        const byNo = exactHits.find(
          (item) => Number(item.question.qno) === page.qno
        );
        if (byNo) {
          return {
            question: byNo.question,
            score: 1,
            reason: "题号+题干全等"
          };
        }
      }
      return {
        question: null,
        reason: "题干全等但存在多条，无法可靠区分",
        closest: { title: exactHits[0].question.question, score: 1 }
      };
    }
    const best = candidates[0];
    const second = candidates[1];
    const closest = { title: best.question.question, score: best.score };
    if (page.qno != null) {
      const byNo = candidates.find(
        (item) => Number(item.question.qno) === page.qno
      );
      if (byNo && byNo.score >= CFG.questionThreshold) {
        return {
          question: byNo.question,
          score: byNo.score,
          reason: "题号+相似度"
        };
      }
    }
    if (best.score < CFG.questionThreshold) {
      return {
        question: null,
        reason: `题干相似度不足：${best.score.toFixed(3)}`,
        closest
      };
    }
    if (second && best.score - second.score < CFG.questionMargin) {
      return {
        question: null,
        reason: "存在多个相似题干，无法可靠区分",
        closest
      };
    }
    return {
      question: best.question,
      score: best.score,
      reason: "题干相似度"
    };
  }
  function getAnswerTexts(question) {
    if (!Array.isArray(question.answer)) {
      return { ok: false, texts: [], reason: "answer 必须是数组" };
    }
    if (question.answer.length === 0) {
      return { ok: false, texts: [], reason: "answer 数组为空" };
    }
    if (!question.answer.every(
      (item) => typeof item === "string" && normalize(item)
    )) {
      return { ok: false, texts: [], reason: "answer 必须全部是非空字符串" };
    }
    const texts = question.answer.map((item) => item.trim());
    const normalized = texts.map(normalize);
    if (new Set(normalized).size !== normalized.length) {
      return { ok: false, texts: [], reason: "answer 存在重复答案" };
    }
    return { ok: true, texts, reason: "" };
  }
  function matchAnswerToOption(answerText, pageOptions, used) {
    const target = normalize(answerText);
    if (!target) {
      return { ok: false, reason: `答案为空：${answerText}` };
    }
    const pool = pageOptions.filter(
      (option) => !used.has(option) && !option.disabled && option.normalizedText
    );
    const exactHits = pool.filter((option) => option.normalizedText === target);
    if (exactHits.length === 1) {
      return { ok: true, option: exactHits[0], mode: "exact" };
    }
    if (exactHits.length > 1) {
      return { ok: true, option: exactHits[0], mode: "exact-multi" };
    }
    const includeHits = pool.filter((option) => {
      const t = option.normalizedText;
      return t.includes(target) || target.includes(t);
    });
    if (includeHits.length === 0) {
      return { ok: false, reason: `页面找不到答案：${answerText}` };
    }
    includeHits.sort(
      (a, b) => Math.abs(a.normalizedText.length - target.length) - Math.abs(b.normalizedText.length - target.length)
    );
    return { ok: true, option: includeHits[0], mode: "include" };
  }
  function matchOptions(answerTexts, pageOptions) {
    const matches = [];
    const used = /* @__PURE__ */ new Set();
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
      matchReason: found.reason
    };
  }
  function solveCurrent() {
    const result = prepareCurrent();
    if (!result.ok) {
      const closest = result.closest;
      const tip2 = closest ? `
最接近：${closest.title}
相似度：${closest.score.toFixed(3)}` : "";
      console.warn("[Solver] 未作答:", result.reason, result);
      setStatus(`未作答：${result.reason}${tip2}`);
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
  function goNext() {
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
      (item) => Number(item.value) === next
    );
    if (!option) return false;
    select.value = option.value;
    select.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  }
  function goPrev() {
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
      (item) => Number(item.value) === prev
    );
    if (!option) return false;
    select.value = option.value;
    select.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  }
  async function waitForPageChange(oldTitle, oldQno) {
    const start = Date.now();
    while (Date.now() - start < CFG.pageTimeout) {
      await sleep(200);
      const page = readPage();
      if (!page.title) continue;
      const titleChanged = normalize(page.title) !== normalize(oldTitle);
      const qnoChanged = page.qno != null && oldQno != null && page.qno !== oldQno;
      if (titleChanged || qnoChanged) return true;
    }
    return false;
  }
  function saveAnswers(raw) {
    const data = JSON.parse(raw);
    if (!Array.isArray(data.questions)) {
      throw new Error("缺少 questions 数组");
    }
    const invalid = data.questions.find(
      (question) => !question || !Array.isArray(question.answer)
    );
    if (invalid) throw new Error("每道题的 answer 都必须是数组");
    const letterOnly = data.questions.filter(
      (q) => Array.isArray(q.answer) && q.answer.length > 0 && q.answer.every((a) => /^[A-Z]$/i.test(String(a).trim()))
    );
    if (letterOnly.length) {
      console.warn(
        "[Solver] 以下题目 answer 疑似字母：",
        letterOnly.map((q) => q.qno)
      );
    }
    GM_setValue(KEY_ANSWERS, JSON.stringify(data));
    return { count: data.questions.length, letterOnly: letterOnly.length };
  }
  function getStoredAnswers() {
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
  function clearAnswers() {
    GM_setValue(KEY_ANSWERS, "");
  }
  function getCurrentBankEntry() {
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
      matchedBy: found.reason
    };
  }

  // eccom-helper/src/panel.js
  function escapeHtml(text) {
    return String(text ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }
  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.style.cssText = "position:fixed;top:-9999px;opacity:0";
      document.body.appendChild(textarea);
      textarea.select();
      try {
        return document.execCommand("copy");
      } catch {
        return false;
      } finally {
        textarea.remove();
      }
    }
  }
  function downloadJson(filename, text) {
    const blob = new Blob([text], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }
  function buildExamJson() {
    const result = collectExamResult();
    if (!result.ok) return { ok: false, reason: result.reason };
    return {
      ok: true,
      json: JSON.stringify(result.data, null, 2),
      kept: result.kept,
      skippedWrong: result.skippedWrong,
      skippedInvalid: result.skippedInvalid
    };
  }
  function examSummary({ kept, skippedWrong, skippedInvalid }) {
    return `${kept} 道答对题（错题 ${skippedWrong}，异常 ${skippedInvalid}）`;
  }
  function renderBankCard(entry) {
    const card = document.getElementById("as-bank-card");
    if (!card) return;
    if (!entry.ok) {
      const closest = entry.closest;
      card.innerHTML = `
      <div class="as-card-head">
        <span class="as-card-tag">题库</span>
        <span class="as-card-state as-state-miss">未匹配</span>
      </div>
      <div class="as-card-reason">${escapeHtml(entry.reason)}</div>
      ${closest ? `<div class="as-card-sub">最接近：${escapeHtml(closest.title)}<br>相似度：${closest.score.toFixed(3)}</div>` : ""}
    `;
      return;
    }
    const answers = entry.answerTexts.map((text) => `<li>${escapeHtml(text)}</li>`).join("");
    card.innerHTML = `
    <div class="as-card-head">
      <span class="as-card-tag">题库</span>
      <span class="as-card-state as-state-hit">${entry.qno != null ? `第 ${entry.qno} 题` : "已匹配"}</span>
    </div>
    <div class="as-card-question">${escapeHtml(entry.question)}</div>
    <div class="as-card-answers">${answers}</div>
    <div class="as-card-meta">${escapeHtml(entry.matchedBy)} · ${entry.score.toFixed(2)}</div>
  `;
  }
  function injectStyles() {
    const style = document.createElement("style");
    style.id = "auto-solver-style";
    style.textContent = panel_default;
    document.head.appendChild(style);
  }
  function init() {
    if (document.getElementById("auto-solver-box")) return;
    injectStyles();
    const box = document.createElement("div");
    box.id = "auto-solver-box";
    box.innerHTML = `
    <div class="as-topbar">
      <div class="as-seg" role="tablist">
        <button id="as-mode-answer" class="as-seg-btn is-active" type="button">答题</button>
        <button id="as-mode-page" class="as-seg-btn" type="button">工具</button>
      </div>
      <span class="as-hint">\`</span>
    </div>

    <div id="as-bank-card" class="as-card"></div>

    <div id="as-body">
      <div class="as-actions">
        <button id="as-prev" type="button">上一题</button>
        <button id="as-solve" class="as-primary" type="button">答题</button>
        <button id="as-next" type="button">下一题</button>
      </div>

      <button id="as-toggle-json" class="as-disclosure" type="button">
        <span class="as-caret">▸</span><span class="as-label">答案 JSON</span>
        <span id="as-json-count" class="as-count"></span>
      </button>

      <div id="as-json-wrap" class="as-json-wrap" style="display:none">
        <textarea id="as-json" spellcheck="false"
          placeholder='粘贴答案 JSON：answer 必须是数组'></textarea>
        <div class="as-json-actions">
          <button id="as-save" type="button">保存</button>
          <button id="as-clear" type="button">清空</button>
        </div>
      </div>
    </div>

    <div id="as-page-tools" style="display:none">
      <button id="as-select-radios" type="button">全选当前页面单选项</button>
      <button id="as-copy-exam" type="button" style="margin-top:8px">
        复制本页答对题 JSON
      </button>
      <button id="as-download-exam" type="button" style="margin-top:8px">
        下载本页答对题 JSON
      </button>
      <div class="as-tools-note">
        逐个点击每个 td 中的单选框。<br>
        从考试结果页收集“得分=满分”的题目，生成答案 JSON 并复制或下载。
      </div>
    </div>

    <div id="as-status" class="as-status">就绪</div>
  `;
    document.body.appendChild(box);
    const $ = (selector) => box.querySelector(selector);
    let activeMode = "answer";
    let hidden = false;
    let jsonOpen = false;
    const setHidden = (value) => {
      hidden = value;
      box.style.display = hidden ? "none" : "block";
      box.setAttribute("aria-hidden", String(hidden));
    };
    const setJsonOpen = (value) => {
      jsonOpen = value;
      $("#as-json-wrap").style.display = jsonOpen ? "block" : "none";
      $("#as-toggle-json").classList.toggle("is-open", jsonOpen);
    };
    const updateJsonCount = () => {
      const saved2 = getStoredAnswers();
      $("#as-json-count").textContent = saved2.raw ? saved2.invalid ? "格式异常" : `${saved2.count} 题` : "未配置";
    };
    const showMode = (mode) => {
      activeMode = mode;
      const answerMode = mode === "answer";
      $("#as-body").style.display = answerMode ? "block" : "none";
      $("#as-page-tools").style.display = answerMode ? "none" : "block";
      $("#as-bank-card").style.display = answerMode ? "block" : "none";
      $("#as-mode-answer").classList.toggle("is-active", answerMode);
      $("#as-mode-page").classList.toggle("is-active", !answerMode);
    };
    const refreshBankCard = () => {
      if (activeMode !== "answer") return;
      renderBankCard(getCurrentBankEntry());
    };
    $("#as-toggle-json").onclick = () => setJsonOpen(!jsonOpen);
    $("#as-mode-answer").onclick = () => {
      showMode("answer");
      refreshBankCard();
    };
    $("#as-mode-page").onclick = () => showMode("page");
    $("#as-select-radios").onclick = () => {
      const count = clickRadiosInCells();
      setStatus(`已点击 ${count} 个单选项`);
    };
    $("#as-copy-exam").onclick = async () => {
      const built = buildExamJson();
      if (!built.ok) {
        setStatus(`生成失败：${built.reason}`);
        return;
      }
      const copied = await copyText(built.json);
      if (!copied) {
        console.warn("[Solver] 复制失败，JSON 如下:", built.json);
        setStatus("复制失败：请检查剪贴板权限，JSON 已输出到控制台");
        return;
      }
      setStatus(`已复制 ${examSummary(built)}`);
    };
    $("#as-download-exam").onclick = () => {
      const built = buildExamJson();
      if (!built.ok) {
        setStatus(`生成失败：${built.reason}`);
        return;
      }
      const now = /* @__PURE__ */ new Date();
      const pad = (n) => String(n).padStart(2, "0");
      const timestamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`;
      downloadJson(`eccom-answers-${timestamp}.json`, built.json);
      setStatus(`已下载 ${examSummary(built)}`);
    };
    document.addEventListener("keydown", (event) => {
      if (event.code === "Backquote") {
        event.preventDefault();
        setHidden(!hidden);
        if (!hidden) {
          refreshBankCard();
          updateJsonCount();
        }
      }
    });
    $("#as-save").onclick = () => {
      try {
        const result = saveAnswers($("#as-json").value);
        const letterTip = result.letterOnly ? `，${result.letterOnly} 道疑似字母` : "";
        setStatus(`已保存 ${result.count} 道题${letterTip}`);
        updateJsonCount();
        refreshBankCard();
        setJsonOpen(false);
      } catch (error) {
        setStatus(`保存失败：${error.message}`);
      }
    };
    $("#as-clear").onclick = () => {
      $("#as-json").value = "";
      clearAnswers();
      setStatus("答案库已清空");
      updateJsonCount();
      refreshBankCard();
    };
    $("#as-solve").onclick = () => {
      solveCurrent();
      refreshBankCard();
    };
    $("#as-prev").onclick = async () => {
      const before = readPage();
      if (!goPrev()) {
        setStatus("没有找到上一题");
        return;
      }
      await waitForPageChange(before.title, before.qno);
      refreshBankCard();
    };
    $("#as-next").onclick = async () => {
      const before = readPage();
      if (!goNext()) {
        setStatus("没有找到下一题");
        return;
      }
      await waitForPageChange(before.title, before.qno);
      refreshBankCard();
    };
    const saved = getStoredAnswers();
    if (saved.raw) {
      $("#as-json").value = saved.raw;
      setStatus(
        saved.invalid ? "已加载，但 JSON 格式异常" : `已加载 ${saved.count} 道题`
      );
    }
    updateJsonCount();
    setJsonOpen(false);
    setHidden(false);
    showMode("answer");
    refreshBankCard();
  }

  // eccom-helper/src/main.js
  if (!window.__autoSolverInjected) {
    window.__autoSolverInjected = true;
    init();
  }
})();
