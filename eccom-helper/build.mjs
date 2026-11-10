import path from "node:path";
import { build } from "esbuild";

const header = `// ==UserScript==
// @name         华讯助手
// @namespace    http://tampermonkey.net/
// @version      7.9
// @description  题干/答案全等优先，include 兜底；紧凑工具型 UI；JSON 输入区可折叠；支持从考试结果页导入答对题目
// @match        *://internal.eccom.com.cn/*
// @grant        GM_setValue
// @grant        GM_getValue
// @run-at       document-idle
// ==/UserScript==`;

await build({
  entryPoints: [path.join(import.meta.dirname, "src/main.js")],
  outfile: path.join(import.meta.dirname, "..", "scripts", "eccom-helper.js"),
  bundle: true,
  format: "iife",
  target: "es2020",
  charset: "utf8",
  legalComments: "none",
  loader: { ".css": "text" },
  banner: { js: header },
});
