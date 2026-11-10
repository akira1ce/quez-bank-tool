# 题库工具集 (Question Bank Tool)

用于转换、合并、去重题库，并把收集到的答案 JSON 聚合成答案库；附带「华讯助手」Tampermonkey 脚本，可在内部考试页面自动匹配合适的选项。

## 目录结构

```
quez-bank-tool/
├── core/                              # Node 题库处理脚本
│   ├── excel_to_txt_universal.js      # Excel 转 TXT
│   ├── merge_txt.js                   # 合并 TXT 题库
│   ├── check_duplicates.js            # 检查重复题目
│   ├── remove_duplicates.js           # 去除重复题目
│   └── merge_answers_json.js          # 聚合答案 JSON 并去重
├── eccom-helper/                      # 华讯助手源码
│   ├── src/                           # ES 模块 + panel.css
│   ├── prompts/                       # 表格转答案 JSON 提示词
│   └── build.mjs                      # esbuild 打包脚本
├── scripts/
│   ├── eccom-helper.js                # 华讯助手（构建产物）
│   └── quez-bank-tool.js              # 旧版搜索脚本（legacy）
├── test/
│   ├── mock-exam.html                 # 本地模拟考试页
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

在内部考试页面（`internal.eccom.com.cn`）自动匹配题库并选中答案，同时支持从考试结果页导出答对题的 JSON。

### 构建

源码在 `eccom-helper/src/`（ES 模块 + CSS），由 esbuild 打包成单个可安装文件：

```bash
npm run build:eccom
```

产物为 `scripts/eccom-helper.js`。安装时把整个文件内容复制到 Tampermonkey 新建脚本中即可。

### 使用

按反引号 `` ` `` 显示/隐藏面板，面板分两个标签页：

- **答题**：上一题 / 答题 / 下一题；下方显示当前题目的匹配结果；「答案 JSON」可展开粘贴答案库并保存
- **工具**：全选当前页面单选项；获取本页答对题 JSON 后复制或下载

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

`test/mock-exam.html` 复刻了考试页的关键 DOM（`#ecmc_body_content`、`#frmAnswer`、`#QNo` 等），内置 20 道来自当前题库的题目（12 单选、4 多选、4 判断）。

测试步骤：

1. 在 Tampermonkey 里给「华讯助手」临时加一行 `// @match file:///*`，并开启扩展的「允许访问文件网址」
2. 打开 `test/mock-exam.html`
3. 按反引号展开面板，把 `test/mock-answers.json` 粘贴到「答案 JSON」并保存
4. 点击「答题」「下一题」，检查选项是否被正确选中

测试完成后删掉临时的 `@match file:///*`。

## 旧版脚本 `scripts/quez-bank-tool.js`

这是最早的做法（旧 README 里叫 `qs.js`），保留作历史参考，不再更新：

- 单文件用户脚本，`@match *://*/*`，无需构建
- 把合并 TXT 生成的汇总内容粘贴进 `QUESTION_BANK_CONTENT` 变量
- 提供关键词/正则搜索、获取当前页面题目、上一题/下一题导航
- 面板可拖拽，宽高和配色保存在 `localStorage`

它的题库输入是 TXT 文本，需要手动粘贴，也没有自动答题能力。现在推荐使用 `core/merge_answers_json.js` 聚合答案 JSON，再配合 `scripts/eccom-helper.js` 使用。

## 依赖

- `xlsx`: ^0.18.5，读取 Excel
- `esbuild`: ^0.28.2，打包用户脚本（仅开发用）

## 许可证

MIT