#!/usr/bin/env node
/**
 * 去除题库文件中题目和答案都完全相同的重复项
 * 使用方法: node remove_duplicates.js <题库文件路径> [输出文件路径]
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
      questions.push({
        index: index + 1,
        type: questionType || "题目",
        question: question.trim(),
        answer: answer.trim(),
        options: options,
        rawBlock: block.trim(),
      });
    }
  }

  return questions;
}

/**
 * 构建题目的完整文本（用于比较）
 */
function buildQuestionText(question) {
  const parts = [];
  parts.push(`# ${question.type}`);
  parts.push(`题目：${question.question}`);

  // 添加选项
  const hasOptions = Object.values(question.options).some((opt) => opt);
  if (hasOptions) {
    for (const [label, text] of Object.entries(question.options)) {
      if (text) {
        parts.push(`${label}. ${text}`);
      }
    }
  }

  parts.push(`答案：${question.answer}`);
  return parts.join("\n");
}

/**
 * 去除重复项
 * @param {string} inputPath - 输入文件路径
 * @param {string} outputPath - 输出文件路径
 */
function removeDuplicates(inputPath, outputPath = null) {
  console.log(`📖 正在解析文件: ${inputPath}\n`);

  const questions = parseQuestionBank(inputPath);
  console.log(`📊 共解析到 ${questions.length} 道题目\n`);

  // 使用 Map 来跟踪已出现的题目（题目+答案作为key）
  const seenMap = new Map();
  const uniqueQuestions = [];
  const removedIndices = [];

  for (const q of questions) {
    // 生成唯一标识：题型 + 题目内容 + 答案
    const key = `${q.type}|${q.question}|${q.answer}`;

    if (seenMap.has(key)) {
      // 发现重复，记录被删除的题目索引
      removedIndices.push({
        index: q.index,
        question: q.question.substring(0, 60) + (q.question.length > 60 ? "..." : ""),
        type: q.type,
        answer: q.answer,
        duplicateOf: seenMap.get(key),
      });
      console.log(`⚠️  删除重复题目 #${q.index} (与 #${seenMap.get(key)} 重复)`);
    } else {
      // 首次出现，保留
      seenMap.set(key, q.index);
      uniqueQuestions.push(q);
    }
  }

  // 生成去重后的内容
  const outputContent = uniqueQuestions
    .map((q) => {
      const parts = [];
      parts.push(`# ${q.type}`);
      parts.push(`题目：${q.question}`);

      // 添加选项
      const hasOptions = Object.values(q.options).some((opt) => opt);
      if (hasOptions) {
        for (const [label, text] of Object.entries(q.options)) {
          if (text) {
            parts.push(`${label}. ${text}`);
          }
        }
      }

      parts.push(`答案：${q.answer}`);
      parts.push("");
      parts.push("---");
      parts.push("");

      return parts.join("\n");
    })
    .join("");

  // 如果没有指定输出路径，使用默认名称
  if (!outputPath) {
    const inputFile = path.parse(inputPath);
    outputPath = path.join(inputFile.dir, `${inputFile.name}_去重.txt`);
  }

  // 写入文件
  fs.writeFileSync(outputPath, outputContent.trim() + "\n", "utf-8");

  console.log("\n" + "=".repeat(80));
  console.log("✅ 去重完成！");
  console.log(`📄 输入文件: ${inputPath}`);
  console.log(`📄 输出文件: ${outputPath}`);
  console.log(`📊 原始题目数: ${questions.length}`);
  console.log(`📊 去重后题目数: ${uniqueQuestions.length}`);
  console.log(`📊 删除重复题目数: ${removedIndices.length}`);
  console.log(`📊 保留率: ${((uniqueQuestions.length / questions.length) * 100).toFixed(2)}%`);

  if (removedIndices.length > 0) {
    console.log("\n📋 删除的重复题目列表:");
    removedIndices.forEach((removed, idx) => {
      console.log(`  ${idx + 1}. 第 ${removed.index} 题 (与第 ${removed.duplicateOf} 题重复)`);
      console.log(`     题型: ${removed.type}`);
      console.log(`     题目: ${removed.question}`);
      console.log(`     答案: ${removed.answer}`);
    });
  }
}

/**
 * 主函数
 */
function main() {
  const args = process.argv.slice(2);

  if (args.length < 1) {
    console.log("使用方法: node remove_duplicates.js <题库文件路径> [输出文件路径]");
    console.log("示例: node remove_duplicates.js 汇总.txt");
    console.log("示例: node remove_duplicates.js 汇总.txt 汇总_去重.txt");
    process.exit(1);
  }

  const inputPath = args[0];
  const outputPath = args[1] || null;

  if (!fs.existsSync(inputPath)) {
    console.error(`❌ 文件不存在: ${inputPath}`);
    process.exit(1);
  }

  removeDuplicates(inputPath, outputPath);
}

if (require.main === module) {
  main();
}

module.exports = { removeDuplicates, parseQuestionBank };
