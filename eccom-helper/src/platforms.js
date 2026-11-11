import { normalize } from "./shared.js";

// 统一平台配置：
// - questionItem：题目容器；null 表示整页只有一道题
// - question：题干选择器（在 questionItem 或 document 内查找）
// - qno：题号 input 选择器（在当前题目容器内，可为 null）
// - options：选项配置；null 表示该平台不能自动勾选
//     item：单个选项容器（在当前题目容器内）
//     input：选项 input（在 item 内）
//     text：选项文本（在 item 内）；null 时取 item 的 innerText
export const PLATFORMS = [
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
      text: "td:last-child",
    },
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
      text: null,
    },
  },
];

export function getPlatform() {
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
        normalizedText: normalize(text),
        disabled: input.disabled,
      },
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
    options: platform.options ? readOptions(platform.options, scope) : [],
  };
}

export function readPageQuestions() {
  const platform = getPlatform();
  if (!platform) return { platform: null, questions: [] };

  const scopes = platform.questionItem
    ? [...document.querySelectorAll(platform.questionItem)]
    : [document];

  const questions = scopes
    .map((scope) => readQuestion(platform, scope))
    .filter(Boolean);

  return { platform, questions };
}
