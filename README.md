# 题库工具集 (Question Bank Tool)

主力是「华讯助手」Tampermonkey 脚本：在考试页面按答案 JSON 匹配题干和选项，自动勾选答案，并支持从考试结果页导出答对题的 JSON。仓库里另有聚合答案库、Excel/TXT 题库处理的辅助脚本。

## 目录结构

```
quez-bank-tool/
├── src/                       # 助手源码
│   ├── main.js                # 注入入口
│   ├── panel.js / panel.css   # 面板 UI
│   ├── platforms.js           # 平台选择器配置
│   ├── questions.js           # 内部题目列表
│   ├── answer.js              # 题干/选项匹配、答题、答案库存储
│   ├── ai.js                  # 问 DeepSeek：请求、提示词、答案解析、Key 存取
│   ├── page-tools.js          # 工具页：全选单选项
│   └── exam-result.js         # 考试结果页 -> 答对题 JSON
├── build.mjs                  # esbuild 打包，产物 scripts/eccom-helper.js
├── prompt.md                  # 表格转答案 JSON 提示词
├── scripts/
│   ├── eccom-helper.js        # 构建产物（安装用）
│   └── quez-bank-tool.js      # 另一平台的 TXT 搜索脚本
├── core/                      # 题库处理脚本
├── test/                      # 两个平台的本地模拟页
├── resouces/                  # 待合并的答案 JSON，合并后自行清空
├── index.json                 # 聚合后的总题库（脚本生成）
├── package.json
└── README.md
```

## 华讯助手

### 支持平台

- `internal.eccom.com.cn`：一页一题，翻页后整页刷新，脚本重新执行
- `eccom.yunxuetang.cn`：所有题目列在同一页

两个平台共用一套匹配和答题逻辑，差异只在 `src/platforms.js` 的选择器配置：

- 华讯：题干 `#ecmc_body_content div > b`，选项行 `#frmAnswer table tr`
- 云学堂：题目 `li[name="li_Question"]`，题干 `.col-18 > div[style*="overflow"]`，选项 `label` + radio/checkbox

云学堂的选项选择器是占位默认值，拿到真实 DOM 后只需改 `platforms.js` 里 `options.item / input / text`。

### 构建安装

```bash
npm install
npm run build
```

产物为 `scripts/eccom-helper.js`，把整个文件内容复制到 Tampermonkey 新建脚本即可。

### 使用

按反引号 `` ` `` 显示/隐藏面板。

**答题**：

- 「获取题目」扫描当前页面并追加到内部列表，按题干去重；页面换题后再点一次
- 「上一题 / 下一题」只切换内部列表并滚动到对应题目，不点击页面按钮；华讯只有一题，这两个按钮保持禁用
- 「答题」按当前内部题目匹配答案并勾选；多选会先清掉不在答案里的已选项
- 「问 AI」把当前题干和页面选项发给 DeepSeek，只显示答案原文，不自动勾选；AI 不确定时显示「不会」
- 卡片显示当前题目的匹配结果；未匹配时显示原因和页面题干
- 卡片下方的搜索框可按关键词搜题库题干，匹配不上时用它查标准答案
- 「答案 JSON」展开后可粘贴答案库并保存

**工具**：

- 填写 / 清除 DeepSeek API Key（保存在脚本存储里，模型固定 `deepseek-flash`）
- 全选当前页面单选项
- 获取本页答对题 JSON，然后复制或下载

### 问 AI（DeepSeek 兜底）

题库匹配不上时，点「问 AI」把当前题干和选项发给 DeepSeek：

- 非流式请求，模型 `deepseek-flash`，关闭思考模式
- 题型按页面选项类型判断：`radio` 为单选，含 `checkbox` 为多选
- 只返回答案原文，不要解释；AI 不确定时返回「不会」，不会瞎蒙
- 结果只展示在 AI 卡片里，不自动勾选页面
- 跨域走 `GM_xmlhttpRequest`，需要 `@connect api.deepseek.com`
- API Key 在「工具」里填写，存在 Tampermonkey 脚本存储中

### 匹配规则

- 题干和选项只做 `trim`，直接按原始文本比较，不做大小写、空白、标点归一化
- 题干：全等优先，找不到再用双向 include 兜底
- 选项：按答案文本逐项匹配，全等优先，include 兜底；匹配不上的答案不会乱选
- `answer` 必须是选项完整文本，不支持 `A/B/C/D` 这类字母
- `qno` 可选，不参与匹配
- 页面文本和题库有换行、空格或 `<br>` 差异时可能匹配不上，用搜索框兜底

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

## 题库维护

### 聚合答案 JSON

```bash
node core/merge_answers_json.js [源目录] [输出文件]
# 默认：resouces/ -> index.json（项目根）
npm run merge:answers
```

规则：

- 已存在的输出文件会作为基准参与合并，可反复合并新增文件
- 每道题的 `answer` 数组先排序
- 题干和答案完全一致视为重复，保留首次出现的条目
- 其余字段原样保留，`qno` 重排为输出顺序的递增序号

### 表格转答案 JSON

把考试结果表格交给 AI 清洗成上面的 JSON，提示词在 `prompt.md`，不参与打包。

## 本地测试

- `test/mock-exam.html`：华讯结构，一页一题
- `test/mock-yunxuetang.html`：云学堂结构，整页 20 题
- `test/mock-answers.json`：两个页面共用的答案库
- `test/mock-similarity.html`：相似度匹配专项，7 个用例，题库 JSON 内嵌在页面里

步骤：

1. 给脚本临时加一行 `// @match file:///*`，并开启 Tampermonkey 的「允许访问文件网址」
2. 打开模拟页，按反引号展开面板，把 `test/mock-answers.json` 粘贴到「答案 JSON」并保存
3. 点「获取题目」再点「答题」，检查选项是否被选中
4. 云学堂用面板的上一题/下一题切题；华讯用页面自身的下一题后重新点「获取题目」

测完删掉临时的 `@match file:///*`。

## 其他题库脚本

Excel/TXT 工具链，输出 TXT 题库：

```bash
node core/excel_to_txt_universal.js <excel文件> [输出文件]
node core/merge_txt.js [输出文件] [源目录]
node core/check_duplicates.js <题库文件>
node core/remove_duplicates.js <题库文件> [输出文件]
```

`scripts/quez-bank-tool.js` 是面向「所有题目列在同一页」平台的独立用户脚本：

- 题库输入是把合并 TXT 的内容粘贴进 `QUESTION_BANK_CONTENT`
- 提供关键词/正则搜索和题目列表导航
- 不自动答题，无需构建

## 依赖

- `xlsx`: ^0.18.5，读取 Excel
- `esbuild`: ^0.28.2，打包用户脚本

## 许可证

MIT
