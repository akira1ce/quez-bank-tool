#!/usr/bin/env node
/**
 * 合并所有 TXT 题库文件到一个汇总文件
 * 使用方法: node merge_txt.js [输出文件路径] [源目录路径]
 */

const fs = require("fs");
const path = require("path");

/**
 * 合并所有 TXT 文件到一个汇总文件
 * @param {string} outputPath - 输出文件路径，默认为"题库汇总.txt"
 * @param {string} sourceDir - 源目录，默认为当前目录
 */
function mergeTxtFiles(outputPath = null, sourceDir = ".") {
  try {
    // 如果没有指定输出路径，使用默认名称
    if (!outputPath) {
      outputPath = path.join(sourceDir, "题库汇总.txt");
    }

    // 读取目录中的所有文件
    const files = fs.readdirSync(sourceDir);

    // 过滤出 TXT 文件，排除脚本文件和汇总文件
    const txtFiles = files
      .filter((file) => {
        return (
          file.endsWith(".txt") &&
          !file.includes("excel_to_txt") &&
          !file.includes("merge_txt") &&
          file !== path.basename(outputPath)
        );
      })
      .sort(); // 按文件名排序

    if (txtFiles.length === 0) {
      console.log("❌ 未找到 TXT 文件");
      process.exit(1);
    }

    console.log(`📋 找到 ${txtFiles.length} 个 TXT 文件:`);
    txtFiles.forEach((file) => console.log(`   - ${file}`));

    // 合并内容
    const mergedContent = [];
    let totalQuestions = 0;

    for (const file of txtFiles) {
      const filePath = path.join(sourceDir, file);
      const content = fs.readFileSync(filePath, "utf-8").trim();

      if (!content) {
        console.log(`⚠️  跳过空文件: ${file}`);
        continue;
      }

      // 添加文件标题分隔符
      const fileName = path.parse(file).name;
      mergedContent.push("");
      mergedContent.push("=".repeat(60));
      mergedContent.push(`# ${fileName}`);
      mergedContent.push("=".repeat(60));
      mergedContent.push("");

      // 添加文件内容
      mergedContent.push(content);

      // 统计题目数量（通过分隔符 "---" 的数量）
      const questionCount = (content.match(/^---$/gm) || []).length;
      totalQuestions += questionCount;

      console.log(`✅ 已添加: ${file} (${questionCount} 道题目)`);
    }

    // 写入汇总文件
    const finalContent = mergedContent.join("\n");
    fs.writeFileSync(outputPath, finalContent, "utf-8");

    console.log("");
    console.log("✅ 合并成功！");
    console.log(`📄 输出文件: ${outputPath}`);
    console.log(`📊 共合并 ${txtFiles.length} 个文件，${totalQuestions} 道题目`);
  } catch (error) {
    console.error(`❌ 合并失败: ${error.message}`);
    process.exit(1);
  }
}

/**
 * 主函数
 */
function main() {
  const args = process.argv.slice(2);

  let outputPath = null;
  let sourceDir = ".";

  // 解析参数
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "-o" || args[i] === "--output") {
      outputPath = args[i + 1];
      i++;
    } else if (args[i] === "-d" || args[i] === "--dir") {
      sourceDir = args[i + 1];
      i++;
    } else if (!outputPath && !args[i].startsWith("-")) {
      outputPath = args[i];
    }
  }

  if (!fs.existsSync(sourceDir)) {
    console.error(`❌ 目录不存在: ${sourceDir}`);
    process.exit(1);
  }

  mergeTxtFiles(outputPath, sourceDir);
}

if (require.main === module) {
  main();
}

module.exports = { mergeTxtFiles };
