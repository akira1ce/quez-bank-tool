// ==UserScript==
// @name         华讯助手
// @namespace    http://tampermonkey.net/
// @version      8.0
// @description  支持华讯/云学堂；手动获取题目、内部切题；题干/答案全等优先，include 兜底
// @match        *://internal.eccom.com.cn/*
// @match        *://eccom.yunxuetang.cn/*
// @grant        GM_setValue
// @grant        GM_getValue
// @run-at       document-idle
// ==/UserScript==
(() => {
  // src/panel.css
  var panel_default = '#auto-solver-box {\n  position: fixed;\n  top: 12px;\n  right: 12px;\n  z-index: 999999;\n  width: 320px;\n  background: #ffffff;\n  color: #1f2937;\n  border: 1px solid #e5e7eb;\n  border-radius: 10px;\n  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.12);\n  padding: 10px;\n  font-family:\n    -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;\n  font-size: 13px;\n  line-height: 1.45;\n}\n#auto-solver-box,\n#auto-solver-box * {\n  box-sizing: border-box;\n}\n#auto-solver-box button {\n  all: unset;\n  box-sizing: border-box;\n  display: inline-flex;\n  align-items: center;\n  justify-content: center;\n  min-height: 30px;\n  padding: 0 10px;\n  border: 1px solid #d1d5db;\n  border-radius: 7px;\n  background: #ffffff;\n  color: #1f2937;\n  font:\n    500 12.5px/1 -apple-system,\n    BlinkMacSystemFont,\n    "Segoe UI",\n    Roboto,\n    Arial,\n    sans-serif;\n  cursor: pointer;\n  text-align: center;\n  transition:\n    background 0.15s,\n    border-color 0.15s,\n    color 0.15s;\n}\n#auto-solver-box button:hover {\n  background: #f3f4f6;\n}\n#auto-solver-box button:active {\n  background: #e5e7eb;\n}\n#auto-solver-box button.as-primary {\n  background: #2563eb;\n  border-color: #2563eb;\n  color: #ffffff;\n}\n#auto-solver-box button.as-primary:hover {\n  background: #1d4ed8;\n  border-color: #1d4ed8;\n}\n\n.as-topbar {\n  display: flex;\n  align-items: center;\n  justify-content: space-between;\n  margin-bottom: 10px;\n}\n.as-seg {\n  display: inline-flex;\n  padding: 2px;\n  background: #f3f4f6;\n  border-radius: 8px;\n  gap: 2px;\n}\n.as-seg-btn {\n  min-height: 26px !important;\n  padding: 0 14px !important;\n  border: 0 !important;\n  background: transparent !important;\n  color: #6b7280 !important;\n  border-radius: 6px !important;\n  font-weight: 500 !important;\n}\n.as-seg-btn:hover {\n  color: #1f2937 !important;\n}\n.as-seg-btn.is-active {\n  background: #ffffff !important;\n  color: #111827 !important;\n  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.08);\n}\n.as-hint {\n  font:\n    11px/1 ui-monospace,\n    SFMono-Regular,\n    Menlo,\n    monospace;\n  color: #9ca3af;\n  padding: 3px 6px;\n  border: 1px solid #e5e7eb;\n  border-radius: 5px;\n}\n\n.as-card {\n  border: 1px solid #e5e7eb;\n  border-radius: 8px;\n  padding: 10px 12px;\n  margin-bottom: 10px;\n  background: #fafbfc;\n}\n.as-card-head {\n  display: flex;\n  align-items: center;\n  justify-content: space-between;\n  margin-bottom: 6px;\n}\n.as-card-tag {\n  font-size: 11px;\n  font-weight: 600;\n  color: #6b7280;\n  letter-spacing: 0.04em;\n  text-transform: uppercase;\n}\n.as-card-state {\n  font-size: 11px;\n  font-weight: 600;\n  padding: 2px 8px;\n  border-radius: 999px;\n}\n.as-state-hit {\n  color: #047857;\n  background: #ecfdf5;\n}\n.as-state-miss {\n  color: #b45309;\n  background: #fffbeb;\n}\n.as-card-question {\n  font-size: 13px;\n  color: #111827;\n  margin-bottom: 8px;\n  white-space: pre-wrap;\n  word-break: break-word;\n}\n.as-card-answers {\n  margin: 0;\n  padding: 0;\n  list-style: none;\n  display: flex;\n  flex-direction: column;\n  gap: 4px;\n}\n.as-card-answers li {\n  font-size: 12.5px;\n  color: #065f46;\n  background: #ecfdf5;\n  border: 1px solid #d1fae5;\n  border-radius: 6px;\n  padding: 5px 8px;\n  white-space: pre-wrap;\n  word-break: break-word;\n}\n.as-card-reason {\n  font-size: 12.5px;\n  color: #b45309;\n  white-space: pre-wrap;\n  word-break: break-word;\n}\n\n.as-search {\n  display: block;\n  width: 100%;\n  margin-bottom: 8px !important;\n  padding: 7px 9px;\n  border: 1px solid #d1d5db;\n  border-radius: 7px;\n  background: #ffffff;\n  color: #111827;\n  font:\n    12.5px/1.45 -apple-system,\n    BlinkMacSystemFont,\n    "Segoe UI",\n    Roboto,\n    Arial,\n    sans-serif;\n  outline: none;\n}\n.as-search:focus {\n  border-color: #2563eb;\n  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.12);\n}\n.as-search-results {\n  display: flex;\n  flex-direction: column;\n  gap: 6px;\n  margin-bottom: 10px;\n  max-height: 240px;\n  overflow-y: auto;\n}\n.as-search-results:empty {\n  display: none;\n}\n.as-search-item {\n  border: 1px solid #e5e7eb;\n  border-radius: 8px;\n  padding: 8px 10px;\n  background: #ffffff;\n}\n.as-search-item .as-card-answers {\n  gap: 3px;\n}\n.as-search-question {\n  font-size: 12.5px;\n  color: #111827;\n  margin-bottom: 6px;\n  white-space: pre-wrap;\n  word-break: break-word;\n}\n.as-search-note {\n  font-size: 11.5px;\n  color: #9ca3af;\n  padding: 2px 0;\n}\n\n.as-actions {\n  display: grid;\n  grid-template-columns: 1fr 1fr;\n  gap: 6px;\n  margin-bottom: 10px;\n}\n.as-actions button {\n  width: 100%;\n}\n\n.as-disclosure {\n  all: unset;\n  box-sizing: border-box;\n  display: flex;\n  align-items: center;\n  gap: 6px;\n  width: 100%;\n  padding: 7px 10px;\n  margin-bottom: 8px;\n  border: 1px dashed #d1d5db;\n  border-radius: 7px;\n  color: #4b5563;\n  font-size: 12.5px;\n  cursor: pointer;\n  background: #ffffff;\n}\n.as-disclosure:hover {\n  background: #f9fafb;\n}\n.as-caret {\n  display: inline-block;\n  width: 12px;\n  color: #9ca3af;\n  transition: transform 0.15s;\n}\n.as-disclosure.is-open .as-caret {\n  transform: rotate(90deg);\n}\n.as-count {\n  margin-left: auto;\n  font-size: 11px;\n  color: #6b7280;\n}\n\n.as-json-wrap {\n  margin-bottom: 10px;\n}\n.as-json-wrap textarea {\n  display: block;\n  width: 100%;\n  height: 120px;\n  min-height: 120px;\n  padding: 8px;\n  border: 1px solid #d1d5db;\n  border-radius: 7px;\n  background: #ffffff;\n  color: #111827;\n  font:\n    12px/1.45 ui-monospace,\n    SFMono-Regular,\n    Menlo,\n    monospace;\n  resize: vertical;\n  outline: none;\n  margin-top: 8px;\n}\n.as-json-wrap textarea:focus {\n  border-color: #2563eb;\n  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.12);\n}\n.as-json-actions {\n  display: grid;\n  grid-template-columns: repeat(2, 1fr);\n  gap: 6px;\n  margin-top: 6px;\n}\n.as-json-actions button {\n  width: 100%;\n}\n\n.as-status {\n  font-size: 12px;\n  color: #6b7280;\n  min-height: 16px;\n  max-height: 140px;\n  overflow-y: auto;\n  white-space: pre-wrap;\n  word-break: break-word;\n  padding: 6px 8px;\n  background: #f9fafb;\n  border-radius: 6px;\n  border: 1px solid #f3f4f6;\n  margin-top: 8px;\n}\n\n.as-tools-row {\n  display: grid;\n  grid-template-columns: 1fr 1fr;\n  gap: 6px;\n  margin-top: 8px;\n}\n\n.as-tools-note {\n  font-size: 11.5px;\n  color: #9ca3af;\n  margin-top: 6px;\n}\n\n#auto-solver-box button:disabled {\n  opacity: 0.45;\n  cursor: not-allowed;\n}\n#auto-solver-box button:disabled:hover,\n#auto-solver-box button:disabled:active {\n  background: #ffffff;\n}\n\n#as-page-tools button {\n  width: 100%;\n}\n\n@media (max-width: 640px) {\n  #auto-solver-box {\n    width: calc(100vw - 24px);\n    right: 12px;\n    left: 12px;\n  }\n}\n';

  // src/shared.js
  function setStatus(message) {
    const el = document.getElementById("as-status");
    if (el) el.textContent = message;
    console.log("[华讯助手]", message);
  }

  // src/page-tools.js
  function clickRadiosInCells() {
    const radios = [...document.querySelectorAll("td")].map((td) => td.querySelector('input[type="radio"]')).filter((radio) => radio && !radio.disabled);
    radios.forEach((radio) => radio.click());
    return radios.length;
  }

  // src/exam-result.js
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

  // src/platforms.js
  var PLATFORMS = [
    {
      id: "eccom",
      name: "华讯",
      match: /internal\.eccom\.com\.cn/,
      questionItem: null,
      question: "#ecmc_body_content div > b",
      qno: "#QNo",
      options: {
        item: "#frmAnswer table tr",
        input: 'input[name="Answer"]',
        text: "td:last-child"
      }
    },
    {
      id: "yunxuetang",
      name: "云学堂",
      match: /eccom\.yunxuetang\.cn/,
      questionItem: 'li[name="li_Question"]',
      question: '.col-18 > div[style*="overflow"]',
      qno: null,
      // 占位选择器：拿到真实 DOM 后替换 item / input / text
      options: {
        item: "label",
        input: 'input[type="radio"], input[type="checkbox"]',
        text: null
      }
    }
  ];
  function getPlatform() {
    return PLATFORMS.find((platform) => platform.match.test(location.href)) ?? null;
  }
  function readOptions(config, scope) {
    return [...scope.querySelectorAll(config.item)].flatMap((item) => {
      const input = item.querySelector(config.input);
      if (!input) return [];
      const textEl = config.text ? item.querySelector(config.text) : item;
      const text = (textEl?.innerText ?? "").trim();
      return [
        {
          input,
          text,
          disabled: input.disabled
        }
      ];
    });
  }
  function readQuestion(platform, scope) {
    const title = scope.querySelector(platform.question)?.innerText.trim() ?? "";
    if (!title) return null;
    const qnoEl = platform.qno ? scope.querySelector(platform.qno) : null;
    const qno = qnoEl ? Number.parseInt(qnoEl.value, 10) : NaN;
    return {
      title,
      qno: Number.isFinite(qno) ? qno : null,
      scope,
      options: platform.options ? readOptions(platform.options, scope) : []
    };
  }
  function readPageQuestions() {
    const platform = getPlatform();
    if (!platform) return { platform: null, questions: [] };
    const scopes = platform.questionItem ? [...document.querySelectorAll(platform.questionItem)] : [document];
    const questions = scopes.map((scope) => readQuestion(platform, scope)).filter(Boolean);
    return { platform, questions };
  }

  // src/questions.js
  var items = [];
  var index = -1;
  function fetchQuestions() {
    const { questions } = readPageQuestions();
    let added = 0;
    for (const question of questions) {
      const key = question.title;
      if (!key || items.some((item) => item.key === key)) continue;
      items.push({ key, title: question.title, qno: question.qno });
      added += 1;
    }
    const pageKeys = questions.map((question) => question.title);
    if (!items[index] || !pageKeys.includes(items[index].key)) {
      const nextIndex = items.findIndex((item) => pageKeys.includes(item.key));
      if (nextIndex >= 0) index = nextIndex;
    }
    if (index < 0 && items.length) index = 0;
    return { found: questions.length, added, total: items.length };
  }
  function getCurrentItem() {
    return items[index] ?? null;
  }
  function getPosition() {
    return { index, total: items.length };
  }
  function moveCurrent(delta) {
    const next = index + delta;
    if (next < 0 || next >= items.length) return null;
    index = next;
    return items[index];
  }
  function findDomQuestion(key) {
    const { questions } = readPageQuestions();
    return questions.find((question) => question.title === key) ?? null;
  }
  function focusItem(item) {
    const dom = findDomQuestion(item.key);
    dom?.scope.scrollIntoView?.({ block: "center", behavior: "smooth" });
    return dom;
  }

  // src/answer.js
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
  function findQuestion(db, title) {
    const target = String(title ?? "").trim();
    if (!target) return null;
    const entries = db.questions.map((question) => ({
      question,
      text: String(question.question ?? "").trim()
    })).filter(({ text }) => text);
    const exact = entries.find(({ text }) => text === target);
    if (exact) return exact.question;
    const included = entries.find(
      ({ text }) => text.includes(target) || target.includes(text)
    );
    return included?.question ?? null;
  }
  function matchOptions(answerTexts, pageOptions) {
    if (!Array.isArray(answerTexts) || !answerTexts.length) return null;
    const used = /* @__PURE__ */ new Set();
    const options = [];
    for (const answerText of answerTexts) {
      const target = String(answerText ?? "").trim();
      if (!target) return null;
      const pool = pageOptions.filter(
        (option2) => !used.has(option2) && !option2.disabled && option2.text
      );
      const option = pool.find((item) => item.text === target) ?? pool.find(
        ({ text }) => text.includes(target) || target.includes(text)
      );
      if (!option) return null;
      used.add(option);
      options.push(option);
    }
    return options;
  }
  function getCurrentBankEntry() {
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
        pageTitle: item.title
      };
    }
    return {
      ok: true,
      qno: question.qno ?? item.qno,
      question: question.question,
      answerTexts: question.answer
    };
  }
  function searchBank(keyword) {
    const db = getAnswerDB();
    if (!db) return { ok: false, reason: "未配置有效答案 JSON", items: [] };
    const query = String(keyword ?? "").trim().toLowerCase();
    if (!query) return { ok: true, total: 0, items: [] };
    const hits = db.questions.filter(
      (question) => String(question.question ?? "").toLowerCase().includes(query)
    );
    return { ok: true, total: hits.length, items: hits.slice(0, 20) };
  }
  function solveCurrent() {
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
  function saveAnswers(raw) {
    const data = JSON.parse(raw);
    if (!Array.isArray(data.questions)) {
      throw new Error("缺少 questions 数组");
    }
    const invalid = data.questions.find(
      (question) => !question || !Array.isArray(question.answer)
    );
    if (invalid) throw new Error("每道题的 answer 都必须是数组");
    GM_setValue(KEY_ANSWERS, JSON.stringify(data));
    return { count: data.questions.length };
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

  // src/panel.js
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
    const { index: index2, total } = getPosition();
    const tag = total ? `题库 ${index2 + 1}/${total}` : "题库";
    if (!entry.ok) {
      const pageTitle = entry.pageTitle ? `<div class="as-card-question">${escapeHtml(entry.pageTitle)}</div>` : "";
      card.innerHTML = `
      <div class="as-card-head">
        <span class="as-card-tag">${tag}</span>
        <span class="as-card-state as-state-miss">未匹配</span>
      </div>
      <div class="as-card-reason">${escapeHtml(entry.reason)}</div>
      ${pageTitle}
    `;
      return;
    }
    const answers = entry.answerTexts.map((text) => `<li>${escapeHtml(text)}</li>`).join("");
    card.innerHTML = `
    <div class="as-card-head">
      <span class="as-card-tag">${tag}</span>
      <span class="as-card-state as-state-hit">${entry.qno != null ? `第 ${entry.qno} 题` : "已匹配"}</span>
    </div>
    <div class="as-card-question">${escapeHtml(entry.question)}</div>
    <div class="as-card-answers">${answers}</div>
  `;
  }
  function renderSearchResults(keyword) {
    const wrap = document.getElementById("as-search-results");
    if (!wrap) return;
    const result = searchBank(keyword);
    if (!keyword.trim()) {
      wrap.innerHTML = "";
      return;
    }
    if (!result.ok) {
      wrap.innerHTML = `<div class="as-search-note">${escapeHtml(result.reason)}</div>`;
      return;
    }
    if (!result.total) {
      wrap.innerHTML = '<div class="as-search-note">题库里没有匹配的题干</div>';
      return;
    }
    const items2 = result.items.map(
      (entry) => `
      <div class="as-search-item">
        <div class="as-search-question">${escapeHtml(entry.question)}</div>
        <ul class="as-card-answers">${(entry.answer ?? []).map((text) => `<li>${escapeHtml(text)}</li>`).join("")}</ul>
      </div>`
    ).join("");
    const more = result.total > result.items.length ? `<div class="as-search-note">另有 ${result.total - result.items.length} 条未显示</div>` : "";
    wrap.innerHTML = items2 + more;
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

    <div id="as-body">
      <div class="as-actions">
        <button id="as-fetch" type="button">获取题目</button>
        <button id="as-solve" class="as-primary" type="button">答题</button>
      </div>
      <div class="as-actions">
        <button id="as-prev" type="button">上一题</button>
        <button id="as-next" type="button">下一题</button>
      </div>

      <div id="as-bank-card" class="as-card"></div>

      <input id="as-search" class="as-search" type="search"
        placeholder="匹配不上时，搜题库题干关键词" spellcheck="false">
      <div id="as-search-results" class="as-search-results"></div>

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
      <button id="as-fetch-exam" type="button" style="margin-top:8px">
        获取本页答对题 JSON
      </button>
      <div class="as-tools-row">
        <button id="as-copy-exam" type="button" disabled>复制</button>
        <button id="as-download-exam" type="button" disabled>下载</button>
      </div>
      <div class="as-tools-note">
        逐个点击每个 td 中的单选框。<br>
        先获取本页答对题 JSON，再复制或下载。
      </div>
    </div>

    <div id="as-status" class="as-status">就绪</div>
  `;
    document.body.appendChild(box);
    const $ = (selector) => box.querySelector(selector);
    let activeMode = "answer";
    let hidden = false;
    let jsonOpen = false;
    let examJson = null;
    const setExportEnabled = (enabled) => {
      $("#as-copy-exam").disabled = !enabled;
      $("#as-download-exam").disabled = !enabled;
    };
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
      $("#as-mode-answer").classList.toggle("is-active", answerMode);
      $("#as-mode-page").classList.toggle("is-active", !answerMode);
    };
    const refreshBankCard = () => {
      if (activeMode !== "answer") return;
      renderBankCard(getCurrentBankEntry());
    };
    const refreshSearch = () => renderSearchResults($("#as-search").value);
    const updateNavigation = () => {
      const { index: index2, total } = getPosition();
      $("#as-prev").disabled = index2 <= 0;
      $("#as-next").disabled = index2 < 0 || index2 >= total - 1;
    };
    const fetchAndRender = (announce) => {
      const result = fetchQuestions();
      updateNavigation();
      refreshBankCard();
      if (announce) {
        setStatus(
          result.found ? `本页 ${result.found} 题，新增 ${result.added} 题，列表共 ${result.total} 题` : "本页未识别到题目"
        );
      }
      return result;
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
    $("#as-fetch-exam").onclick = () => {
      const built = buildExamJson();
      if (!built.ok) {
        examJson = null;
        setExportEnabled(false);
        setStatus(`生成失败：${built.reason}`);
        return;
      }
      examJson = built;
      setExportEnabled(true);
      setStatus(`已获取 ${examSummary(built)}，可复制或下载`);
    };
    $("#as-copy-exam").onclick = async () => {
      const copied = await copyText(examJson.json);
      if (!copied) {
        console.warn("[Solver] 复制失败，JSON 如下:", examJson.json);
        setStatus("复制失败：请检查剪贴板权限，JSON 已输出到控制台");
        return;
      }
      setStatus(`已复制 ${examSummary(examJson)}`);
    };
    $("#as-download-exam").onclick = () => {
      const now = /* @__PURE__ */ new Date();
      const pad = (n) => String(n).padStart(2, "0");
      const timestamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`;
      downloadJson(`eccom-answers-${timestamp}.json`, examJson.json);
      setStatus(`已下载 ${examSummary(examJson)}`);
    };
    document.addEventListener("keydown", (event) => {
      if (event.code === "Backquote") {
        event.preventDefault();
        setHidden(!hidden);
        if (!hidden) {
          refreshBankCard();
          updateNavigation();
          updateJsonCount();
        }
      }
    });
    $("#as-save").onclick = () => {
      try {
        const result = saveAnswers($("#as-json").value);
        setStatus(`已保存 ${result.count} 道题`);
        updateJsonCount();
        refreshBankCard();
        refreshSearch();
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
      refreshSearch();
    };
    $("#as-search").oninput = () => refreshSearch();
    $("#as-fetch").onclick = () => fetchAndRender(true);
    $("#as-solve").onclick = () => {
      const result = solveCurrent();
      setStatus(result.ok ? `已选 ${result.count} 项` : `未作答：${result.reason}`);
      refreshBankCard();
    };
    $("#as-prev").onclick = () => {
      const item = moveCurrent(-1);
      if (!item) return;
      focusItem(item);
      updateNavigation();
      refreshBankCard();
    };
    $("#as-next").onclick = () => {
      const item = moveCurrent(1);
      if (!item) return;
      focusItem(item);
      updateNavigation();
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
    const platform = getPlatform();
    if (platform) {
      const result = fetchAndRender(false);
      setStatus(`${platform.name}：识别 ${result.total} 题`);
    } else {
      updateNavigation();
      refreshBankCard();
      setStatus("当前页面不在支持的平台内");
    }
  }

  // src/main.js
  if (!window.__autoSolverInjected) {
    window.__autoSolverInjected = true;
    init();
  }
})();
