import path from "node:path";
import { build } from "esbuild";

const header = `// ==UserScript==
// @name         华讯助手
// @namespace    http://tampermonkey.net/
// @version      8.1
// @description  支持华讯/云学堂；题库匹配答题，可问 DeepSeek 兜底；导出答对题 JSON
// @match        *://internal.eccom.com.cn/*
// @match        *://eccom.yunxuetang.cn/*
// @noframes
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_xmlhttpRequest
// @connect      api.deepseek.com
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
