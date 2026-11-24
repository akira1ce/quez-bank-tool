const KEY_API = "auto_solver_deepseek_key";
const API_URL = "https://api.deepseek.com/chat/completions";
const MODEL = "deepseek-flash";
const TIMEOUT = 30_000;

const SYSTEM_PROMPT = `你是一个严格的选择题答题器。用户会给你一道选择题，标注【单选】或【多选】，并给出题干和选项。

必须遵守：
1. 只输出一个 JSON 数组，元素是正确选项的完整原文，逐字复制，不改写、不概括、不加字母前缀。
2. 单选只放 1 个元素；多选放全部正确选项，按题目中的选项顺序排列。
3. 不要输出解释、注释或 markdown 代码块，数组外不要有任何字符。

输出示例：
单选 → ["TCP 是面向连接的协议"]
多选 → ["选项一完整原文", "选项二完整原文"]`;

export function getApiKey() {
  return String(GM_getValue(KEY_API, "") ?? "").trim();
}

export function setApiKey(key) {
  GM_setValue(KEY_API, String(key ?? "").trim());
}

export function clearApiKey() {
  GM_setValue(KEY_API, "");
}

function buildUserPrompt(title, options, isMulti) {
  const lines = options.map(
    (option, index) => `${String.fromCharCode(65 + index)}. ${option.text}`,
  );
  return `【${isMulti ? "多选" : "单选"}】\n题干：${title}\n选项：\n${lines.join("\n")}`;
}

function parseContent(content, options) {
  const raw = String(content ?? "").trim();
  if (!raw) return { ok: false, reason: "AI 没有返回内容" };

  const text = raw
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();

  if (!text.startsWith("[") && /^(不会|不知道|无法确定|不确定)/.test(text)) {
    return { ok: true, unknown: true, answers: [] };
  }

  let list;
  try {
    const parsed = JSON.parse(text);
    if (!Array.isArray(parsed)) {
      return { ok: false, reason: "AI 返回格式异常" };
    }
    list = parsed;
  } catch {
    list = text.split(/\r?\n/);
  }

  const answers = [];
  for (const entry of list) {
    let value = String(entry ?? "")
      .replace(/^\s*[-*•]\s*/, "")
      .replace(/^\d+[.、)]\s*/, "")
      .replace(/^[A-Z][.、)]\s*/i, "")
      .trim();
    if (!value) continue;

    // 模型偶尔仍回字母，按选项顺序还原成原文
    const letters = value.replace(/[\s,，、]+/g, "");
    const isOptionText = options.some((option) => option.text === value);
    if (!isOptionText && /^[A-Z]+$/.test(letters)) {
      const mapped = [...letters].map(
        (letter) => options[letter.charCodeAt(0) - 65]?.text,
      );
      if (mapped.every(Boolean)) {
        for (const answerText of mapped) {
          if (!answers.includes(answerText)) answers.push(answerText);
        }
        continue;
      }
    }

    if (!answers.includes(value)) answers.push(value);
  }

  if (!answers.length) return { ok: false, reason: "AI 返回无法识别" };
  return { ok: true, unknown: false, answers };
}

export function askDeepSeek({ title, options }) {
  const key = getApiKey();
  if (!key) {
    return Promise.resolve({
      ok: false,
      needKey: true,
      reason: "未配置 API Key",
    });
  }

  const usable = options.filter((option) => option.text);
  if (!usable.length) {
    return Promise.resolve({ ok: false, reason: "页面没有可用的选项" });
  }

  const isMulti = usable.some((option) => option.input?.type === "checkbox");

  const payload = {
    model: MODEL,
    stream: false,
    temperature: 0,
    max_tokens: 256,
    thinking: { type: "disabled" },
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: buildUserPrompt(title, usable, isMulti) },
    ],
  };

  return new Promise((resolve) => {
    GM_xmlhttpRequest({
      method: "POST",
      url: API_URL,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      data: JSON.stringify(payload),
      timeout: TIMEOUT,
      onload(response) {
        let data;
        try {
          data = JSON.parse(response.responseText);
        } catch {
          resolve({
            ok: false,
            reason: `响应解析失败（HTTP ${response.status}）`,
          });
          return;
        }

        if (response.status !== 200) {
          const message = data?.error?.message ? `：${data.error.message}` : "";
          resolve({
            ok: false,
            reason: `请求失败（HTTP ${response.status}）${message}`,
          });
          return;
        }

        const content = data?.choices?.[0]?.message?.content ?? "";
        resolve({ ...parseContent(content, usable), isMulti });
      },
      onerror: () => resolve({ ok: false, reason: "网络请求失败" }),
      ontimeout: () => resolve({ ok: false, reason: "请求超时" }),
    });
  });
}
