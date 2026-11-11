# 题库工具集 (Question Bank Tool)

用于转换、合并、去重题库，并把收集到的答案 JSON 聚合成答案库；附带 Tampermonkey 助手脚本，支持华讯和云学堂两个平台，可匹配题库并自动选中答案。

## 目录结构

```
quez-bank-tool/
├── core/                              # Node 题库处理脚本
│   ├── excel_to_txt_universal.js      # Excel 转 TXT
│   ├── merge_txt.js                   # 合并 TXT 题库
│   ├── check_duplicates.js            # 检查重复题目
│   ├── remove_duplicates.js           # 去除重复题目
│   └── merge_answers_json.js          # 聚合答案 JSON 并去重
├── eccom-helper/                      # 助手源码（华讯/云学堂）
│   ├── src/                           # ES 模块 + panel.css
│   ├── prompts/                       # 表格转答案 JSON 提示词
│   └── build.mjs                      # esbuild 打包脚本
├── scripts/
│   ├── eccom-helper.js                # 华讯助手（构建产物）
│   └── quez-bank-tool.js              # 另一平台的 TXT 搜索脚本
├── test/
│   ├── mock-exam.html                 # 华讯：一页一题模拟页
│   ├── mock-yunxuetang.html           # 云学堂：整页列题模拟页
│   └── mock-answers.json              # 模拟页对应的答案库
├── resouces/                          # 收集到的答案 JSON（聚合输入）
├── package.json
└── README.md
```

## 环境

- Node.js >= 18
- 安装依赖：`npm install`

## 题库处理脚本

### 1. Excel 转 TXT (`core/excel_to_txt_universal.js`)

```bash
node core/excel_to_txt_universal.js <excel文件路径> [输出文件路径]
```

不传输出路径时，默认生成 Excel 同目录同名 `.txt`。

支持的表头格式：

- `题型-问题-正确答案-选项A-选项B-选项C-选项D-选项E-选项F`
- `题型-问题-答案-选项A-选项B-选项C-选项D`
- `题目-答案-A-B-C-D`

输出格式：

```
# 单选题
题目：这是题目内容
A. 选项A内容
B. 选项B内容
答案：A
---
```

### 2. 合并 TXT (`core/merge_txt.js`)

```bash
node core/merge_txt.js [输出文件路径] [源目录路径]
node core/merge_txt.js -o 题库汇总.txt -d ./题库目录
```

默认合并当前目录所有 TXT，输出到源目录下的 `题库汇总.txt`。

### 3. 检查重复 (`core/check_duplicates.js`)

按题目内容查重（不比较答案）：

```bash
node core/check_duplicates.js 题库汇总.txt
```

### 4. 去除重复 (`core/remove_duplicates.js`)

题目和答案都完全相同的条目会被删除：

```bash
node core/remove_duplicates.js 题库汇总.txt [输出文件路径]
```

默认输出 `原文件名_去重.txt`。

### 5. 聚合答案 JSON (`core/merge_answers_json.js`)

递归读取目录下收集到的答案 JSON，合并成一个答案库：

```bash
node core/merge_answers_json.js [源目录] [输出文件]
# 默认：resouces/ -> resouces/merged-answers.json
npm run merge:answers
```

规则：

- 每道题的 `answer` 数组先排序
- 题目和答案完全一致视为重复，保留首次出现的条目
- 其余字段（包括 `qno`）原样保留

## 华讯助手

在考试页面匹配题库并选中答案，同时支持从考试结果页导出答对题的 JSON。

支持两个平台：

- `internal.eccom.com.cn`：一页一题，翻页后页面刷新，脚本重新执行
- `eccom.yunxuetang.cn`：所有题目列在同一页

两个平台共用同一套匹配逻辑，差异只在 `eccom-helper/src/platforms.js` 的选择器配置里。

### 构建

源码在 `eccom-helper/src/`（ES 模块 + CSS），由 esbuild 打包成单个可安装文件：

```bash
npm run build:eccom
```

产物为 `scripts/eccom-helper.js`。安装时把整个文件内容复制到 Tampermonkey 新建脚本中即可。

### 使用

按反引号 `` ` `` 显示/隐藏面板，面板分两个标签页：

- **答题**：获取题目 / 答题；上一题、下一题只切换脚本内部的题目列表，不点击页面按钮；下方显示当前题目的匹配结果；「答案 JSON」可展开粘贴答案库并保存
- **工具**：全选当前页面单选项；获取本页答对题 JSON 后复制或下载

「获取题目」会扫描当前页面并追加到内部列表，按题干去重。华讯一页只有一题，上一题/下一题保持禁用；云学堂会一次识别本页所有题目，切题时滚动到对应位置。

云学堂的选项选择器目前是占位默认值（`label` + `input[type="radio"], input[type="checkbox"]`），拿到真实 DOM 后在 `platforms.js` 里替换 `options.item / input / text` 即可。

匹配规则：

- 题干和选项文本都先做规范化（NFKC、去空白和标点、转小写）
- 先找全等，找不到再用 include（双向包含）兜底
- `answer` 必须是选项的完整文本，不支持 `A/B/C/D` 这类字母
- `qno` 可选，不参与匹配

### 答案 JSON 格式

```json
{
  "questions": [
    {
      "qno": 1,
      "question": "题干原文",
      "answer": ["正确选项的完整文本"]
    }
  ]
}
```

多选时 `answer` 放多个完整选项文本。

### 表格转答案 JSON 提示词

在 `eccom-helper/prompts/table-to-answers-json.md`，用于把考试结果表格整理成上面的 JSON，不参与打包。

## 本地测试模拟考试页

`test/mock-exam.html` 复刻了华讯考试页的关键 DOM（`#ecmc_body_content`、`#frmAnswer`、`#QNo` 等），内置 20 道来自当前题库的题目（12 单选、4 多选、4 判断）。

`test/mock-yunxuetang.html` 复刻云学堂的整页列题结构（`li[name="li_Question"]`、`.col-18 > div`、选项 `label` + radio/checkbox），题目相同，可直接复用同一份 `mock-answers.json`。

测试步骤：

1. 在 Tampermonkey 里给「华讯助手」临时加一行 `// @match file:///*`，并开启扩展的「允许访问文件网址」
2. 打开 `test/mock-exam.html` 或 `test/mock-yunxuetang.html`
3. 按反引号展开面板，把 `test/mock-answers.json` 粘贴到「答案 JSON」并保存
4. 点击「获取题目」再点「答题」，检查选项是否被正确选中
5. 云学堂页可用面板的「上一题 / 下一题」切题；华讯页用页面自身的「下一题」切题后，重新点「获取题目」再答题（模拟页不会整页刷新）

测试完成后删掉临时的 `@match file:///*`。

## 另一平台的搜索脚本 `scripts/quez-bank-tool.js`

这是面向「所有题目列在同一页」平台的另一套脚本，和 `eccom-helper.js` 的自动答题逻辑相互独立：

- 单文件用户脚本，`@match *://*/*`，无需构建
- 题库输入是合并 TXT 的汇总内容，粘贴进 `QUESTION_BANK_CONTENT` 变量
- 提供关键词/正则搜索、题目列表导航，不会自动勾选答案
- 面板可拖拽，宽高和配色保存在 `localStorage`

两套脚本的题库来源不同：quez-bank-tool 用 TXT，eccom-helper 用答案 JSON。

## 依赖

- `xlsx`: ^0.18.5，读取 Excel
- `esbuild`: ^0.28.2，打包用户脚本（仅开发用）

## 许可证

MIT