import path from "node:path";
import { build } from "esbuild";

const header = `// ==UserScript==
// @name         华讯助手
// @namespace    http://tampermonkey.net/
// @version      8.0
// @description  支持华讯/云学堂；手动获取题目、内部切题；题干/答案全等优先，include 兜底
// @match        *://internal.eccom.com.cn/*
// @match        *://eccom.yunxuetang.cn/*
// @grant        GM_setValue
// @grant        GM_getValue
// @run-at       document-idle
// ==/UserScript==`;

await build({
  entryPoints: [path.join(import.meta.dirname, "src/main.js")],
  outfile: path.join(import.meta.dirname, "scripts", "eccom-helper.js"),
  bundle: true,
  format: "iife",
  target: "es2020",
  charset: "utf8",
  legalComments: "none",
  loader: { ".css": "text" },
  banner: { js: header },
});
