#!/usr/bin/env node
/**
 * 检查题库文件中的重复题目
 * 使用方法: node check_duplicates.js <题库文件路径>
 */

const fs = require("fs");
const path = require("path");

/**
 * 解析题库文件
 * @param {string} filePath - 文件路径
 * @returns {Array} 题目数组
 */
function parseQuestionBank(filePath) {
  const content = fs.readFileSync(filePath, "utf-8");
  const questions = [];
  const blocks = content.split(/\n---\n/);

  for (let index = 0; index < blocks.length; index++) {
    const block = blocks[index];
    const lines = block
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l);

    if (lines.length === 0) continue;

    let questionType = "";
    let question = "";
    let answer = "";
    const options = { A: "", B: "", C: "", D: "", E: "", F: "" };

    let i = 0;

    // 解析题型
    if (lines[i] && lines[i].startsWith("# ")) {
      questionType = lines[i].substring(2).trim();
      i++;
    }

    // 解析题目
    if (lines[i] && lines[i].startsWith("题目：")) {
      question = lines[i].substring(3).trim();
      i++;
    }

    // 解析选项（选择题）
    const isChoice = questionType.includes("单选") || questionType.includes("多选");
    if (isChoice) {
      while (i < lines.length) {
        if (lines[i].startsWith("答案：")) {
          answer = lines[i].substring(3).trim();
          i++;
          break;
        }
        const optionMatch = lines[i].match(/^([A-F])\.\s*(.+)$/);
        if (optionMatch) {
          const label = optionMatch[1];
          const text = optionMatch[2];
          if (options.hasOwnProperty(label)) {
            options[label] = text;
          }
          i++;
        } else {
          question += "\n" + lines[i];
          i++;
        }
      }
    } else {
      // 判断题
      for (let j = i; j < lines.length; j++) {
        if (lines[j].startsWith("答案：")) {
          answer = lines[j].substring(3).trim();
          break;
        }
        if (!lines[j].startsWith("答案：")) {
          question += (question ? "\n" : "") + lines[j];
        }
      }
    }

    if (question && answer) {
      // 生成题目的唯一标识（题目内容 + 答案）
      const questionKey = `${questionType}|${question.trim()}|${answer}`;

      questions.push({
        index: index + 1,
        type: questionType || "题目",
        question: question.trim(),
        answer: answer,
        options: options,
        key: questionKey,
        rawBlock: block.trim(),
      });
    }
  }

  return questions;
}

/**
 * 检查重复项
 * @param {string} filePath - 文件路径
 */
function checkDuplicates(filePath) {
  console.log(`📖 正在解析文件: ${filePath}\n`);

  const questions = parseQuestionBank(filePath);
  console.log(`📊 共解析到 ${questions.length} 道题目\n`);

  // 使用 Map 来统计重复项
  const questionMap = new Map();
  const duplicates = [];

  for (const q of questions) {
    // 使用题目内容作为key（不包含答案，因为同一题目可能有不同答案）
    const contentKey = `${q.type}|${q.question}`;

    if (questionMap.has(contentKey)) {
      const existing = questionMap.get(contentKey);
      duplicates.push({
        key: contentKey,
        question: q.question,
        type: q.type,
        occurrences: [
          { index: existing.index, answer: existing.answer },
          { index: q.index, answer: q.answer },
        ],
      });
      // 更新为包含所有出现位置
      questionMap.set(contentKey, {
        ...existing,
        occurrences: [
          ...(existing.occurrences || [{ index: existing.index, answer: existing.answer }]),
          { index: q.index, answer: q.answer },
        ],
      });
    } else {
      questionMap.set(contentKey, {
        ...q,
        occurrences: [{ index: q.index, answer: q.answer }],
      });
    }
  }

  // 收集所有重复项
  const allDuplicates = [];
  for (const [key, value] of questionMap.entries()) {
    if (value.occurrences && value.occurrences.length > 1) {
      allDuplicates.push({
        key: key,
        question: value.question,
        type: value.type,
        occurrences: value.occurrences,
      });
    }
  }

  if (allDuplicates.length === 0) {
    console.log("✅ 未发现重复题目！");
    return;
  }

  console.log(`⚠️  发现 ${allDuplicates.length} 组重复题目：\n`);
  console.log("=".repeat(80));

  // 按出现次数排序
  allDuplicates.sort((a, b) => b.occurrences.length - a.occurrences.length);

  for (let i = 0; i < allDuplicates.length; i++) {
    const dup = allDuplicates[i];
    console.log(`\n【重复组 ${i + 1}】出现 ${dup.occurrences.length} 次`);
    console.log(`题型: ${dup.type}`);
    console.log(`题目: ${dup.question.substring(0, 100)}${dup.question.length > 100 ? "..." : ""}`);
    console.log(`出现位置:`);
    dup.occurrences.forEach((occ, idx) => {
      console.log(`  ${idx + 1}. 第 ${occ.index} 题 - 答案: ${occ.answer}`);
    });
    console.log("-".repeat(80));
  }

  // 统计信息
  const totalDuplicateCount = allDuplicates.reduce((sum, dup) => sum + dup.occurrences.length, 0);
  const uniqueDuplicateCount = allDuplicates.length;
  console.log(`\n📈 统计信息:`);
  console.log(`   重复题目组数: ${uniqueDuplicateCount}`);
  console.log(`   重复题目总数: ${totalDuplicateCount}`);
  console.log(`   唯一题目数: ${questions.length - totalDuplicateCount + uniqueDuplicateCount}`);
}

/**
 * 主函数
 */
function main() {
  const args = process.argv.slice(2);

  if (args.length < 1) {
    console.log("使用方法: node check_duplicates.js <题库文件路径>");
    console.log("示例: node check_duplicates.js 汇总.txt");
    process.exit(1);
  }

  const filePath = args[0];

  if (!fs.existsSync(filePath)) {
    console.error(`❌ 文件不存在: ${filePath}`);
    process.exit(1);
  }

  checkDuplicates(filePath);
}

if (require.main === module) {
  main();
}

module.exports = { checkDuplicates, parseQuestionBank };
