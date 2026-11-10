// ==UserScript==
// @name         华讯助手
// @namespace    http://tampermonkey.net/
// @version      7.1
// @description  统一答案数组，全等优先 include 兜底匹配；紧凑工具型 UI；JSON 输入区可折叠；支持从考试结果页导入答对题目
// @match        *://internal.eccom.com.cn/*
// @grant        GM_setValue
// @grant        GM_getValue
// @run-at       document-idle
// ==/UserScript==

(function () {
  "use strict";

  if (window.__autoSolverInjected) return;
  window.__autoSolverInjected = true;

  const PROMPT_TEMPLATES = Object.freeze({
    tableToAnswersJSON: `
你是数据清洗助手。把下面的"题目表格"转成严格 JSON（表格可能来自 Excel 粘贴，也可能是截图识别出的文本）。

【输出格式】
{
  "questions": [
    { "qno": 10, "question": "TCP 的特点是？", "answer": ["TCP 是面向连接的协议"] }
  ]
}

【规则】
1. qno：整数题号。从表格题号列读取；没有题号列时按出现顺序从 1 开始编号。
2. question：题干原文。去掉开头题号（"10." "第10题"），去掉全部选项（A. B. C. D. 及其内容），去掉多余换行和首尾空格，保留原标点。
3. answer：字符串数组，不能是字母。
   - 每个元素是**选项完整文本**，从表格选项里逐字复制，不改写、不概括、不加 "A." 前缀。
   - 单选：长度 1；多选：长度 ≥ 2；判断：["正确"] 或 ["错误"]（与页面选项文本一致）。
4. 答案文本必须与选项文本逐字一致（空格、标点、全半角保留），只去掉题号和 ABCD 前缀。
5. 答案缺失或无法确定时跳过该题，不要编造。
6. 只输出 JSON 本体：不要 markdown 代码块、不要解释、不要注释、不要尾随逗号。字符串内双引号用 \\" 转义。

【反例（禁止）】
- ❌ "answer": ["A"]                          // 字母不是选项文本
- ❌ "answer": ["A. TCP 是面向连接的协议"]     // 带前缀
- ❌ "question": "10. TCP 的特点是？ A. ... B. ..."  // 题干含题号和选项
- ❌ \`\`\`json ... \`\`\`                      // 代码块包裹

【表格内容】
{{粘贴表格文本 / 截图识别文本}}
`,
  });

  const Shared = (() => {
    const CFG = {
      questionSelector: "#ecmc_body_content div > b",
      qnoInput: "#QNo",
      optionRowSelector: "#frmAnswer table tr",
      optionSelector: 'input[name="Answer"]',
      nextBtn: "#btnNext",
      prevBtn: "#btnPrev",
      gotoSelect: "#selQNo",

      delay: 1000,
      pageTimeout: 10000,

      // 题干匹配：全等优先，include 兜底
      questionThreshold: 0.75,
      questionMargin: 0.08,
    };

    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

    function normalize(text) {
      return String(text ?? "")
        .normalize("NFKC")
        .replace(/\s+/g, "")
        .replace(/[，。？！、；：""''（）【】《》,.?!;:"'()\[\]<>·—–\-_]/g, "")
        .replace(/[０-９]/g, (c) =>
          String.fromCharCode(c.charCodeAt(0) - 0xfee0),
        )
        .toLowerCase();
    }

    function similarity(a, b) {
      a = normalize(a);
      b = normalize(b);

      if (!a || !b) return 0;
      if (a === b) return 1;

      if (a.includes(b) || b.includes(a)) {
        const ratio =
          Math.min(a.length, b.length) / Math.max(a.length, b.length);
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

    function stripPrefix(text) {
      return String(text ?? "")
        .replace(/^\s*[（(]?\s*[A-ZＡ-Ｚa-z]\s*[)）]?\s*[.、)．:：]?\s*/i, "")
        .trim();
    }

    function setStatus(message) {
      const el = document.getElementById("as-status");
      if (el) el.textContent = message;
      console.log("[华讯助手]", message);
    }

    return { CFG, sleep, normalize, similarity, stripPrefix, setStatus };
  })();

  const PageToolsModule = (() => {
    function clickRadiosInCells() {
      const radios = [...document.querySelectorAll("td")]
        .map((td) => td.querySelector('input[type="radio"]'))
        .filter((radio) => radio && !radio.disabled);

      radios.forEach((radio) => radio.click());
      return radios.length;
    }

    return { clickRadiosInCells };
  })();

  // ============================================================
  // 考试结果页导入：收集“得分=满分”的题目，生成答案 JSON
  // ============================================================
  const ExamResultModule = (() => {
    const TABLE_SELECTOR =
      "table.table-dataList.table-grid, table.table-dataList";
    const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

    function clean(text) {
      return String(text ?? "")
        .replace(/\u00a0/g, " ")
        .replace(/\s+/g, " ")
        .trim();
    }

    // 解析 "题目...<br> [A]xxx [B]yyy [C]zzz [D]www"
    function parseQuestionCell(cell) {
      const html = cell.innerHTML || "";
      const parts = html
        .split(/<br\s*\/?>/i)
        .map((s) => {
          const div = document.createElement("div");
          div.innerHTML = s;
          return clean(div.textContent);
        })
        .filter(Boolean);

      if (!parts.length) return { question: "", options: [] };

      const optionLineIndex = parts.findIndex((p) => /\[A\]/i.test(p));
      const questionParts =
        optionLineIndex === -1 ? parts : parts.slice(0, optionLineIndex);
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

    // "ABCD" / "A,B" -> ["A","B","C","D"]
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

    function collect() {
      const table = document.querySelector(TABLE_SELECTOR);
      if (!table) {
        return { ok: false, reason: "当前页面没有找到考试结果表格" };
      }

      const rows = [...table.querySelectorAll("tbody > tr")];
      const questions = [];
      let skippedWrong = 0;
      let skippedInvalid = 0;

      for (const row of rows) {
        if (row.querySelector("th")) continue; // 表头

        const cells = [...row.children];
        if (cells.length < 6) continue;

        // 列顺序：# / 类型 / 题目 / 分值 / 回答 / 得分 / 评分者
        const qnoText = clean(cells[0].textContent);
        const qno = Number.parseInt(qnoText.replace(/[^\d]/g, ""), 10);
        if (!Number.isFinite(qno)) continue;

        const typeText = clean(cells[1].textContent);
        const questionCell = cells[2];
        const scoreFull = parseNumber(cells[3].textContent);
        const answerRaw = cells[4].textContent;
        const scoreGot = parseNumber(cells[5].textContent);

        // 只收答对的题：得分等于满分（都非空）
        if (
          scoreFull == null ||
          scoreGot == null ||
          Math.abs(scoreFull - scoreGot) > 1e-6
        ) {
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

        const isJudge =
          /判断/.test(typeText) ||
          (options.length === 2 &&
            options.every((o) =>
              /^(正确|错误|对|错|是|否|True|False)$/i.test(o.text),
            ));

        let answer = [];

        if (isJudge) {
          const opt =
            options.find((o) => o.letter === letters[0]) ||
            options.find((o) => clean(o.text) === rawAnswer) ||
            options[0];
          answer = [opt.text];
        } else if (letters.length) {
          const byLetter = new Map(options.map((o) => [o.letter, o.text]));
          answer = letters.map((l) => byLetter.get(l)).filter(Boolean);
        } else {
          // 兜底：回答文本直接等于某个选项文本
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
          reason: `没有收集到答对的题目（错题 ${skippedWrong}，格式异常 ${skippedInvalid}）`,
        };
      }

      return {
        ok: true,
        data: { questions },
        total: rows.length,
        kept: questions.length,
        skippedWrong,
        skippedInvalid,
      };
    }

    return { collect };
  })();

  const AnswerModule = (() => {
    const { CFG, sleep, normalize, similarity, stripPrefix, setStatus } =
      Shared;
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

    function readPage() {
      const qnoEl = document.querySelector(CFG.qnoInput);
      const titleEl = document.querySelector(CFG.questionSelector);

      const parsedQno = qnoEl ? Number.parseInt(qnoEl.value, 10) : NaN;

      const options = [
        ...document.querySelectorAll(CFG.optionRowSelector),
      ].flatMap((row) => {
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
      });

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
        (option) =>
          !used.has(option) && !option.disabled && option.normalizedText,
      );

      // 1) 规范化全等
      const exactHits = pool.filter(
        (option) => option.normalizedText === target,
      );
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

    function solveCurrent() {
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
        (item) => Number(item.value) === next,
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
        (item) => Number(item.value) === prev,
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
        const qnoChanged =
          page.qno != null && oldQno != null && page.qno !== oldQno;
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

    function getStoredAnswers() {
      const raw = GM_getValue(KEY_ANSWERS, "");
      if (!raw) return { raw: "", count: 0, invalid: false };
      try {
        const data = JSON.parse(raw);
        if (!Array.isArray(data.questions))
          throw new Error("缺少 questions 数组");
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
        matchedBy: found.reason,
      };
    }

    return {
      readPage,
      solveCurrent,
      goNext,
      goPrev,
      waitForPageChange,
      saveAnswers,
      getStoredAnswers,
      clearAnswers,
      getCurrentBankEntry,
    };
  })();

  const Panel = (() => {
    const { setStatus } = Shared;

    function escapeHtml(text) {
      return String(text ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
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
          ${
            closest
              ? `<div class="as-card-sub">最接近：${escapeHtml(closest.title)}<br>相似度：${closest.score.toFixed(3)}</div>`
              : ""
          }
        `;
        return;
      }

      const answers = entry.answerTexts
        .map((text) => `<li>${escapeHtml(text)}</li>`)
        .join("");

      card.innerHTML = `
        <div class="as-card-head">
          <span class="as-card-tag">题库</span>
          <span class="as-card-state as-state-hit">${
            entry.qno != null ? `第 ${entry.qno} 题` : "已匹配"
          }</span>
        </div>
        <div class="as-card-question">${escapeHtml(entry.question)}</div>
        <div class="as-card-answers">${answers}</div>
        <div class="as-card-meta">${escapeHtml(entry.matchedBy)} · ${entry.score.toFixed(2)}</div>
      `;
    }

    function buildUI() {
      if (document.getElementById("auto-solver-box")) return;

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
              <button id="as-load" type="button">读取</button>
              <button id="as-clear" type="button">清空</button>
            </div>
          </div>

          <div id="as-status" class="as-status">就绪</div>
        </div>

        <div id="as-page-tools" style="display:none">
          <button id="as-select-radios" type="button">全选当前页面单选项</button>
          <button id="as-import-exam" type="button" style="margin-top:8px">
            从本页考试结果生成 JSON
          </button>
          <div class="as-tools-note">
            逐个点击每个 td 中的单选框。<br>
            从考试结果页收集“得分=满分”的题目，生成答案 JSON。
          </div>
        </div>
      `;

      if (!document.getElementById("auto-solver-style")) {
        const style = document.createElement("style");
        style.id = "auto-solver-style";
        style.textContent = `
          #auto-solver-box {
            position: fixed; top: 12px; right: 12px; z-index: 999999;
            width: 320px;
            background: #ffffff; color: #1f2937;
            border: 1px solid #e5e7eb; border-radius: 10px;
            box-shadow: 0 8px 24px rgba(15, 23, 42, 0.12);
            padding: 10px;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
            font-size: 13px; line-height: 1.45;
          }
          #auto-solver-box, #auto-solver-box * { box-sizing: border-box; }
          #auto-solver-box button {
            all: unset;
            box-sizing: border-box;
            display: inline-flex; align-items: center; justify-content: center;
            min-height: 30px; padding: 0 10px;
            border: 1px solid #d1d5db; border-radius: 7px;
            background: #ffffff; color: #1f2937;
            font: 500 12.5px/1 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
            cursor: pointer; text-align: center;
            transition: background .15s, border-color .15s, color .15s;
          }
          #auto-solver-box button:hover { background: #f3f4f6; }
          #auto-solver-box button:active { background: #e5e7eb; }
          #auto-solver-box button.as-primary {
            background: #2563eb; border-color: #2563eb; color: #ffffff;
          }
          #auto-solver-box button.as-primary:hover { background: #1d4ed8; border-color: #1d4ed8; }

          .as-topbar { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
          .as-seg { display: inline-flex; padding: 2px; background: #f3f4f6; border-radius: 8px; gap: 2px; }
          .as-seg-btn { min-height: 26px !important; padding: 0 14px !important; border: 0 !important; background: transparent !important; color: #6b7280 !important; border-radius: 6px !important; font-weight: 500 !important; }
          .as-seg-btn:hover { color: #1f2937 !important; }
          .as-seg-btn.is-active { background: #ffffff !important; color: #111827 !important; box-shadow: 0 1px 2px rgba(0,0,0,.08); }
          .as-hint { font: 11px/1 ui-monospace, SFMono-Regular, Menlo, monospace; color: #9ca3af; padding: 3px 6px; border: 1px solid #e5e7eb; border-radius: 5px; }

          .as-card {
            border: 1px solid #e5e7eb; border-radius: 8px;
            padding: 10px 12px; margin-bottom: 10px;
            background: #fafbfc;
          }
          .as-card-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px; }
          .as-card-tag { font-size: 11px; font-weight: 600; color: #6b7280; letter-spacing: .04em; text-transform: uppercase; }
          .as-card-state { font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 999px; }
          .as-state-hit { color: #047857; background: #ecfdf5; }
          .as-state-miss { color: #b45309; background: #fffbeb; }
          .as-card-question { font-size: 13px; color: #111827; margin-bottom: 8px; white-space: pre-wrap; word-break: break-word; }
          .as-card-answers { margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 4px; }
          .as-card-answers li {
            font-size: 12.5px; color: #065f46; background: #ecfdf5;
            border: 1px solid #d1fae5; border-radius: 6px;
            padding: 5px 8px; white-space: pre-wrap; word-break: break-word;
          }
          .as-card-meta { font-size: 11px; color: #9ca3af; margin-top: 6px; }
          .as-card-reason { font-size: 12.5px; color: #b45309; white-space: pre-wrap; word-break: break-word; }
          .as-card-sub { font-size: 11.5px; color: #6b7280; margin-top: 6px; }

          .as-actions { display: grid; grid-template-columns: 1fr 1.2fr 1fr; gap: 6px; margin-bottom: 10px; }
          .as-actions button { width: 100%; }

          .as-disclosure {
            all: unset;
            box-sizing: border-box;
            display: flex; align-items: center; gap: 6px; width: 100%;
            padding: 7px 10px; margin-bottom: 8px;
            border: 1px dashed #d1d5db; border-radius: 7px;
            color: #4b5563; font-size: 12.5px; cursor: pointer;
            background: #ffffff;
          }
          .as-disclosure:hover { background: #f9fafb; }
          .as-caret { display: inline-block; width: 12px; color: #9ca3af; transition: transform .15s; }
          .as-disclosure.is-open .as-caret { transform: rotate(90deg); }
          .as-count { margin-left: auto; font-size: 11px; color: #6b7280; }

          .as-json-wrap { margin-bottom: 10px; }
          .as-json-wrap textarea {
            display: block; width: 100%; height: 120px; min-height: 120px;
            padding: 8px; border: 1px solid #d1d5db; border-radius: 7px;
            background: #ffffff; color: #111827;
            font: 12px/1.45 ui-monospace, SFMono-Regular, Menlo, monospace;
            resize: vertical; outline: none;
            margin-top: 8px;
          }
          .as-json-wrap textarea:focus { border-color: #2563eb; box-shadow: 0 0 0 3px rgba(37, 99, 235, .12); }
          .as-json-actions { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; margin-top: 6px; }
          .as-json-actions button { width: 100%; }

          .as-status {
            font-size: 12px; color: #6b7280;
            min-height: 16px; max-height: 140px; overflow-y: auto;
            white-space: pre-wrap; word-break: break-word;
            padding: 6px 8px; background: #f9fafb; border-radius: 6px;
            border: 1px solid #f3f4f6;
          }

          .as-tools-note { font-size: 11.5px; color: #9ca3af; margin-top: 6px; }

          #as-page-tools button { width: 100%; }

          @media (max-width: 640px) {
            #auto-solver-box { width: calc(100vw - 24px); right: 12px; left: 12px; }
          }
        `;
        document.head.appendChild(style);
      }

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
        const saved = AnswerModule.getStoredAnswers();
        $("#as-json-count").textContent = saved.raw
          ? saved.invalid
            ? "格式异常"
            : `${saved.count} 题`
          : "未配置";
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
        renderBankCard(AnswerModule.getCurrentBankEntry());
      };

      $("#as-toggle-json").onclick = () => setJsonOpen(!jsonOpen);

      $("#as-mode-answer").onclick = () => {
        showMode("answer");
        refreshBankCard();
      };
      $("#as-mode-page").onclick = () => showMode("page");

      $("#as-select-radios").onclick = () => {
        const count = PageToolsModule.clickRadiosInCells();
        setStatus(`已点击 ${count} 个单选项`);
      };

      $("#as-import-exam").onclick = () => {
        const result = ExamResultModule.collect();

        if (!result.ok) {
          setStatus(`导入失败：${result.reason}`);
          return;
        }

        const json = JSON.stringify(result.data, null, 2);

        showMode("answer");
        setJsonOpen(true);

        const textarea = $("#as-json");
        textarea.value = json;

        try {
          const saved = AnswerModule.saveAnswers(json);
          const letterTip = saved.letterOnly
            ? `，${saved.letterOnly} 道疑似字母`
            : "";
          setStatus(
            `已导入 ${saved.count} 道答对题（错题 ${result.skippedWrong}，异常 ${result.skippedInvalid}）${letterTip}`,
          );
          updateJsonCount();
          refreshBankCard();
        } catch (error) {
          setStatus(`已生成 JSON 但保存失败：${error.message}`);
        }
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
          const result = AnswerModule.saveAnswers($("#as-json").value);
          const letterTip = result.letterOnly
            ? `，${result.letterOnly} 道疑似字母`
            : "";
          setStatus(`已保存 ${result.count} 道题${letterTip}`);
          updateJsonCount();
          refreshBankCard();
          setJsonOpen(false);
        } catch (error) {
          setStatus(`保存失败：${error.message}`);
        }
      };

      $("#as-load").onclick = () => {
        const saved = AnswerModule.getStoredAnswers();
        if (!saved.raw) {
          setStatus("存储中没有答案");
          return;
        }
        $("#as-json").value = saved.raw;
        setStatus(
          saved.invalid ? "JSON 格式异常" : `已读取 ${saved.count} 道题`,
        );
        updateJsonCount();
        refreshBankCard();
      };

      $("#as-clear").onclick = () => {
        $("#as-json").value = "";
        AnswerModule.clearAnswers();
        setStatus("答案库已清空");
        updateJsonCount();
        refreshBankCard();
      };

      $("#as-solve").onclick = () => {
        AnswerModule.solveCurrent();
        refreshBankCard();
      };

      $("#as-prev").onclick = async () => {
        const before = AnswerModule.readPage();
        if (!AnswerModule.goPrev()) {
          setStatus("没有找到上一题");
          return;
        }
        await AnswerModule.waitForPageChange(before.title, before.qno);
        refreshBankCard();
      };

      $("#as-next").onclick = async () => {
        const before = AnswerModule.readPage();
        if (!AnswerModule.goNext()) {
          setStatus("没有找到下一题");
          return;
        }
        await AnswerModule.waitForPageChange(before.title, before.qno);
        refreshBankCard();
      };

      const saved = AnswerModule.getStoredAnswers();
      if (saved.raw) {
        $("#as-json").value = saved.raw;
        setStatus(
          saved.invalid
            ? "已加载，但 JSON 格式异常"
            : `已加载 ${saved.count} 道题`,
        );
      }
      updateJsonCount();

      setJsonOpen(false);
      setHidden(false);
      showMode("answer");
      refreshBankCard();
    }

    return { init: buildUI };
  })();

  Panel.init();
})();
