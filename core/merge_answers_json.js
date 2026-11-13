const fs = require("fs");
const path = require("path");

const DEFAULT_DIR = "resouces";
const DEFAULT_OUTPUT = "index.json";

function collectJsonFiles(dir) {
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .flatMap((entry) => {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) return collectJsonFiles(full);
      return entry.isFile() && entry.name.endsWith(".json") ? [full] : [];
    })
    .sort((a, b) => a.localeCompare(b, "zh-CN", { numeric: true }));
}

function addQuestions(data, seen, questions) {
  let total = 0;

  for (const question of data.questions) {
    total++;
    const entry = { ...question, answer: [...question.answer].sort() };
    const key = JSON.stringify([entry.question, entry.answer]);
    if (seen.has(key)) continue;
    seen.add(key);
    questions.push(entry);
  }

  return total;
}

function mergeAnswers(sourceDir, outputPath) {
  const outputAbs = path.resolve(outputPath);
  const files = collectJsonFiles(sourceDir).filter(
    (file) => path.resolve(file) !== outputAbs,
  );

  const seen = new Set();
  const questions = [];
  let baseTotal = 0;

  if (fs.existsSync(outputAbs)) {
    const base = JSON.parse(fs.readFileSync(outputAbs, "utf8"));
    baseTotal = addQuestions(base, seen, questions);
  }

  let total = baseTotal;
  for (const file of files) {
    const data = JSON.parse(fs.readFileSync(file, "utf8"));
    total += addQuestions(data, seen, questions);
  }

  const output = questions.map((question, index) => ({
    ...question,
    qno: index + 1,
  }));

  fs.mkdirSync(path.dirname(outputAbs), { recursive: true });
  fs.writeFileSync(
    outputAbs,
    `${JSON.stringify({ questions: output }, null, 2)}\n`,
    "utf8",
  );

  return {
    outputPath: outputAbs,
    files: files.length,
    baseTotal,
    total,
    unique: questions.length,
  };
}

function main() {
  const [sourceArg, outputArg] = process.argv.slice(2);
  const sourceDir = sourceArg || DEFAULT_DIR;
  const outputPath = outputArg || DEFAULT_OUTPUT;

  if (!fs.existsSync(sourceDir) || !fs.statSync(sourceDir).isDirectory()) {
    console.error(`目录不存在: ${sourceDir}`);
    process.exit(1);
  }

  const summary = mergeAnswers(sourceDir, outputPath);

  const baseNote = summary.baseTotal
    ? ` + 上次合并结果 ${summary.baseTotal} 道`
    : "";
  console.log(
    `已读取 ${summary.files} 个文件${baseNote}，共 ${summary.total} 道题，去重后 ${summary.unique} 道（移除 ${summary.total - summary.unique} 道）`,
  );
  console.log(`输出: ${summary.outputPath}`);
}

if (require.main === module) {
  main();
}

module.exports = { mergeAnswers };
