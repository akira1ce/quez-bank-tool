#!/usr/bin/env node
/**
 * Excel 题库转 TXT 知识库脚本（通用版）
 * 支持多种表头格式：
 * 格式1: 题型-问题-正确答案-选项A-选项B-选项C-选项D-选项E-选项F
 * 格式2: 题型-问题-答案-选项A-选项B-选项C-选项D
 * 格式3: 题目-答案-A-B-C-D
 * 使用方法: node excel_to_txt_universal.js <excel文件路径> [输出文件路径]
 */

const XLSX = require("xlsx");
const fs = require("fs");
const path = require("path");

/**
 * 将 Excel 题库转换为 TXT 知识库格式
 * @param {string} excelPath - Excel 文件路径
 * @param {string} outputPath - 输出 TXT 文件路径，默认为 Excel 同目录同名文件
 */
function convertExcelToTxt(excelPath, outputPath = null) {
  try {
    // 读取 Excel 文件
    const workbook = XLSX.readFile(excelPath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];

    // 转换为 JSON 格式
    const data = XLSX.utils.sheet_to_json(worksheet);

    if (data.length === 0) {
      console.log("❌ Excel 文件为空");
      process.exit(1);
    }

    const firstRow = data[0];
    const allColumns = Object.keys(firstRow);

    // 调试信息：显示所有列名
    console.log(`📋 Excel 列名: ${allColumns.join(", ")}`);

    // 自动检测列名映射
    const columnMap = {
      questionType: null, // 题型
      question: null, // 题目/问题
      answer: null, // 正确答案/答案
      options: [], // 选项列
    };

    // 检测题型列
    if ("题型" in firstRow) {
      columnMap.questionType = "题型";
    }

    // 检测题目列
    if ("问题" in firstRow) {
      columnMap.question = "问题";
    } else if ("题目" in firstRow) {
      columnMap.question = "题目";
    }

    // 检测答案列
    if ("正确答案" in firstRow) {
      columnMap.answer = "正确答案";
    } else if ("答案" in firstRow) {
      columnMap.answer = "答案";
    }

    // 检测选项列（优先检测"选项A"格式，再检测"A"格式）
    const optionKeysV1 = ["选项A", "选项B", "选项C", "选项D", "选项E", "选项F"];
    const optionKeysV2 = ["A", "B", "C", "D", "E", "F"];

    let optionFormat = null;
    for (const key of optionKeysV1) {
      if (key in firstRow) {
        optionFormat = "v1"; // 选项A格式
        break;
      }
    }

    if (!optionFormat) {
      for (const key of optionKeysV2) {
        if (key in firstRow) {
          optionFormat = "v2"; // A格式
          break;
        }
      }
    }

    if (optionFormat === "v1") {
      columnMap.options = optionKeysV1;
    } else if (optionFormat === "v2") {
      columnMap.options = optionKeysV2;
    }

    // 验证必要的列
    if (!columnMap.question) {
      console.log("❌ 缺少题目列（需要'问题'或'题目'列）");
      process.exit(1);
    }

    if (!columnMap.answer) {
      console.log("❌ 缺少答案列（需要'正确答案'或'答案'列）");
      process.exit(1);
    }

    // 如果没有指定输出路径，使用同目录同名文件
    if (!outputPath) {
      const excelFile = path.parse(excelPath);
      outputPath = path.join(excelFile.dir, `${excelFile.name}.txt`);
    }

    // 生成 TXT 内容
    const txtContent = [];
    let questionCount = 0;

    for (const row of data) {
      // 跳过空行
      if (!row[columnMap.question]) {
        continue;
      }

      // 获取题型（如果有）
      let questionType = "题目";
      if (columnMap.questionType && row[columnMap.questionType]) {
        questionType = String(row[columnMap.questionType]).trim();
      }

      const question = String(row[columnMap.question]).trim();
      const correctAnswer = row[columnMap.answer] ? String(row[columnMap.answer]).trim() : "";

      // 构建题目块
      const questionBlock = [];
      questionBlock.push(`# ${questionType}`);
      questionBlock.push(`题目：${question}`);

      // 处理选项（如果有题型信息，判断是否为选择题）
      const isChoiceQuestion =
        columnMap.questionType && (questionType.includes("单选") || questionType.includes("多选"));

      // 如果没有题型列，但有选项列，也当作选择题处理
      const hasOptions = columnMap.options.length > 0;

      if (isChoiceQuestion || (!columnMap.questionType && hasOptions)) {
        const options = [];

        for (let i = 0; i < columnMap.options.length; i++) {
          const optionKey = columnMap.options[i];
          const optionLabel = optionFormat === "v1" ? String.fromCharCode(65 + i) : optionKey; // v1格式需要转换，v2格式直接使用

          // 检查是否存在该列且有值
          if (optionKey in row && row[optionKey] !== null && row[optionKey] !== undefined) {
            const optionText = String(row[optionKey]).trim();
            if (optionText && optionText !== "") {
              options.push(`${optionLabel}. ${optionText}`);
            }
          }
        }

        if (options.length > 0) {
          questionBlock.push(...options);
        }
      }

      // 添加答案
      if (correctAnswer) {
        questionBlock.push(`答案：${correctAnswer}`);
      }

      // 添加题目块
      txtContent.push(questionBlock.join("\n"));
      txtContent.push(""); // 空行
      txtContent.push("---"); // 分隔符
      txtContent.push(""); // 空行

      questionCount++;
    }

    // 写入文件
    fs.writeFileSync(outputPath, txtContent.join("\n"), "utf-8");

    console.log("✅ 转换成功！");
    console.log(`📄 输入文件: ${excelPath}`);
    console.log(`📄 输出文件: ${outputPath}`);
    console.log(`📊 共转换 ${questionCount} 道题目`);
  } catch (error) {
    console.error(`❌ 转换失败: ${error.message}`);
    process.exit(1);
  }
}

/**
 * 主函数
 */
function main() {
  const args = process.argv.slice(2);

  if (args.length < 1) {
    console.log("使用方法: node excel_to_txt_universal.js <excel文件路径> [输出文件路径]");
    console.log("示例: node excel_to_txt_universal.js 题库.xlsx");
    console.log("示例: node excel_to_txt_universal.js 题库.xlsx 输出.txt");
    process.exit(1);
  }

  const excelPath = args[0];
  const outputPath = args[1] || null;

  if (!fs.existsSync(excelPath)) {
    console.error(`❌ 文件不存在: ${excelPath}`);
    process.exit(1);
  }

  convertExcelToTxt(excelPath, outputPath);
}

if (require.main === module) {
  main();
}

module.exports = { convertExcelToTxt };
