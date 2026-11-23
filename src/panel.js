import panelCss from "./panel.css";
import { setStatus } from "./shared.js";
import { clickRadiosInCells, isRestartWatching, setRestartWatching } from "./page-tools.js";
import { collectExamResult } from "./exam-result.js";
import { getPlatform } from "./platforms.js";
import {
  fetchQuestions,
  getPosition,
  getCurrentItem,
  moveCurrent,
  focusItem,
  findDomQuestion,
} from "./questions.js";
import {
  solveCurrent,
  saveAnswers,
  getStoredAnswers,
  clearAnswers,
  getCurrentBankEntry,
  searchBank,
} from "./answer.js";
import {
  askDeepSeek,
  getApiKey,
  setApiKey,
  clearApiKey,
} from "./ai.js";

function escapeHtml(text) {
  return String(text ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
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
    skippedInvalid: result.skippedInvalid,
  };
}

function examSummary({ kept, skippedWrong, skippedInvalid }) {
  return `${kept} 道答对题（错题 ${skippedWrong}，异常 ${skippedInvalid}）`;
}

function renderBankCard(entry) {
  const card = document.getElementById("as-bank-card");
  if (!card) return;

  const { index, total } = getPosition();
  const tag = total ? `题库 ${index + 1}/${total}` : "题库";

  if (!entry.ok) {
    const pageTitle = entry.pageTitle
      ? `<div class="as-card-question">${escapeHtml(entry.pageTitle)}</div>`
      : "";

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

  const answers = entry.answerTexts
    .map((text) => `<li>${escapeHtml(text)}</li>`)
    .join("");

  card.innerHTML = `
    <div class="as-card-head">
      <span class="as-card-tag">${tag}</span>
      <span class="as-card-state as-state-hit">${
        entry.qno != null ? `第 ${entry.qno} 题` : "已匹配"
      }</span>
    </div>
    <div class="as-card-question">${escapeHtml(entry.question)}</div>
    <div class="as-card-answers">${answers}</div>
  `;
}

function renderAiCard(result) {
  const card = document.getElementById("as-ai-card");
  if (!card) return;

  const type = result.isMulti ? "多选" : "单选";

  if (result.unknown) {
    card.innerHTML = `
      <div class="as-card-head">
        <span class="as-card-tag">AI · ${type}</span>
        <span class="as-card-state as-state-miss">不会</span>
      </div>
      <div class="as-card-reason">AI 无法确定答案，未给出选项</div>
    `;
    card.style.display = "block";
    return;
  }

  const answers = result.answers
    .map((text) => `<li>${escapeHtml(text)}</li>`)
    .join("");

  card.innerHTML = `
    <div class="as-card-head">
      <span class="as-card-tag">AI · ${type}</span>
      <span class="as-card-state as-state-ai">答案</span>
    </div>
    <ul class="as-card-answers">${answers}</ul>
  `;
  card.style.display = "block";
}

function clearAiCard() {
  const card = document.getElementById("as-ai-card");
  if (!card) return;

  card.style.display = "none";
  card.innerHTML = "";
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

  const items = result.items
    .map(
      (entry) => `
      <div class="as-search-item">
        <div class="as-search-question">${escapeHtml(entry.question)}</div>
        <ul class="as-card-answers">${(entry.answer ?? [])
          .map((text) => `<li>${escapeHtml(text)}</li>`)
          .join("")}</ul>
      </div>`,
    )
    .join("");

  const more =
    result.total > result.items.length
      ? `<div class="as-search-note">另有 ${result.total - result.items.length} 条未显示</div>`
      : "";

  wrap.innerHTML = items + more;
}

function injectStyles() {
  const style = document.createElement("style");
  style.id = "auto-solver-style";
  style.textContent = panelCss;
  document.head.appendChild(style);
}

export function init() {
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
        <button id="as-ask-ai" class="as-ask-ai" type="button">问 AI</button>
        <button id="as-prev" type="button">上一题</button>
        <button id="as-next" type="button">下一题</button>
      </div>

      <div id="as-bank-card" class="as-card"></div>
      <div id="as-ai-card" class="as-card as-ai-card" style="display:none"></div>

      <div class="as-search-wrap">
        <input id="as-search" class="as-search" type="search"
          placeholder="匹配不上时，搜题库题干关键词" spellcheck="false">
      </div>
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
      <div class="as-key-section">
        <div class="as-key-title">DeepSeek API Key</div>
        <input id="as-api-key" class="as-search" type="password" placeholder="sk-..."
          autocomplete="off" spellcheck="false">
        <div class="as-actions">
          <button id="as-save-key" type="button">保存 Key</button>
          <button id="as-clear-key" type="button">清除 Key</button>
        </div>
        <div id="as-key-state" class="as-tools-note">未配置</div>
      </div>
      <button id="as-restart-watch" type="button">开启继续学习检测</button>
      <button id="as-select-radios" type="button" style="margin-top:8px">全选当前页面单选项</button>
      <button id="as-fetch-exam" type="button" style="margin-top:8px">
        获取本页答对题 JSON
      </button>
      <div class="as-tools-row">
        <button id="as-copy-exam" type="button" disabled>复制</button>
        <button id="as-download-exam" type="button" disabled>下载</button>
      </div>
      <div class="as-tools-note">
        逐个点击每个 td 中的单选框。<br>
        先获取本页答对题 JSON，再复制或下载。<br>
        继续学习检测：每 30 秒查一次 #reStartStudy，出现即点击。
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
    const saved = getStoredAnswers();
    $("#as-json-count").textContent = saved.raw
      ? saved.invalid
        ? "格式异常"
        : `${saved.count} 题`
      : "未配置";
  };

  const updateKeyState = () => {
    $("#as-key-state").textContent = getApiKey() ? "已配置" : "未配置";
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
    const { index, total } = getPosition();
    $("#as-prev").disabled = index <= 0;
    $("#as-next").disabled = index < 0 || index >= total - 1;
  };

  const fetchAndRender = (announce) => {
    const result = fetchQuestions();
    updateNavigation();
    refreshBankCard();
    clearAiCard();

    if (announce) {
      setStatus(
        result.found
          ? `本页 ${result.found} 题，新增 ${result.added} 题，列表共 ${result.total} 题`
          : "本页未识别到题目",
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

  $("#as-save-key").onclick = () => {
    const value = $("#as-api-key").value.trim();
    if (!value) {
      setStatus("请输入 API Key");
      return;
    }

    setApiKey(value);
    $("#as-api-key").value = "";
    updateKeyState();
    setStatus("API Key 已保存");
  };

  $("#as-clear-key").onclick = () => {
    clearApiKey();
    $("#as-api-key").value = "";
    updateKeyState();
    setStatus("API Key 已清除");
  };

  $("#as-restart-watch").onclick = () => {
    const on = !isRestartWatching();
    const button = $("#as-restart-watch");

    setStatus(on ? "已开启继续学习检测（每 30 秒）" : "已关闭继续学习检测");
    setRestartWatching(on, () => setStatus("已点击「继续学习」"));
    button.textContent = on ? "停止继续学习检测" : "开启继续学习检测";
    button.classList.toggle("as-primary", on);
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
    const now = new Date();
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

  $("#as-ask-ai").onclick = () => {
    const item = getCurrentItem();
    if (!item) {
      setStatus("请先点击「获取题目」");
      return;
    }

    const dom = findDomQuestion(item.key);
    if (!dom) {
      setStatus("页面已刷新，请重新获取题目");
      return;
    }
    if (!dom.options.length) {
      setStatus("页面没有可用的选项");
      return;
    }
    if (!getApiKey()) {
      setStatus("未配置 API Key，请在「工具」里填写");
      showMode("page");
      $("#as-api-key").focus();
      return;
    }

    const button = $("#as-ask-ai");
    button.disabled = true;
    button.textContent = "查询中…";
    clearAiCard();
    setStatus("正在问 AI…");

    askDeepSeek({ title: dom.title, options: dom.options })
      .then((result) => {
        if (!result.ok) {
          setStatus(`问 AI 失败：${result.reason}`);
          return;
        }

        renderAiCard(result);
        setStatus(
          result.unknown
            ? "AI 无法确定答案"
            : `AI 给出 ${result.answers.length} 个答案`,
        );
      })
      .finally(() => {
        button.disabled = false;
        button.textContent = "问 AI";
      });
  };

  $("#as-prev").onclick = () => {
    const item = moveCurrent(-1);
    if (!item) return;

    focusItem(item);
    updateNavigation();
    refreshBankCard();
    clearAiCard();
  };

  $("#as-next").onclick = () => {
    const item = moveCurrent(1);
    if (!item) return;

    focusItem(item);
    updateNavigation();
    refreshBankCard();
    clearAiCard();
  };

  const saved = getStoredAnswers();
  if (saved.raw) {
    $("#as-json").value = saved.raw;
    setStatus(
      saved.invalid ? "已加载，但 JSON 格式异常" : `已加载 ${saved.count} 道题`,
    );
  }
  updateJsonCount();
  updateKeyState();

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
