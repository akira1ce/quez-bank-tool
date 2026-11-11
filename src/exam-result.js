const TABLE_SELECTOR = "table.table-dataList.table-grid, table.table-dataList";
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

export function collectExamResult() {
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
