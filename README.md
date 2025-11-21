# 题库工具集 (Question Bank Tool)

一个用于处理和管理题库的工具集，支持 Excel 题库转换、文件合并、去重检查等功能，并提供浏览器脚本用于在线搜索题库内容。

## 功能特性

- 📊 **Excel 转 TXT**：将 Excel 格式的题库转换为标准 TXT 知识库格式
- 🔗 **文件合并**：合并多个 TXT 题库文件到一个汇总文件
- 🔍 **重复检查**：检查题库中的重复题目
- ✂️ **去重处理**：自动去除完全重复的题目
- 🌐 **浏览器脚本**：Tampermonkey 脚本，支持在线搜索题库内容

## 安装

### 前置要求

- Node.js >= 12.0.0
- npm 或 yarn

### 安装依赖

```bash
npm install
```

## 使用方法

### 1. Excel 转 TXT (`excel_to_txt_universal.js`)

将 Excel 题库文件转换为 TXT 格式的知识库文件。

**支持的 Excel 格式：**

- 格式1: `题型-问题-正确答案-选项A-选项B-选项C-选项D-选项E-选项F`
- 格式2: `题型-问题-答案-选项A-选项B-选项C-选项D`
- 格式3: `题目-答案-A-B-C-D`

**使用方法：**

```bash
node scripts/excel_to_txt_universal.js <excel文件路径> [输出文件路径]
```

**示例：**

```bash
# 使用默认输出路径（同目录同名文件）
node scripts/excel_to_txt_universal.js 题库.xlsx

# 指定输出路径
node scripts/excel_to_txt_universal.js 题库.xlsx 输出.txt
```

**输出格式：**

```
# 单选题
题目：这是题目内容
A. 选项A内容
B. 选项B内容
C. 选项C内容
D. 选项D内容
答案：A

---

# 判断题
题目：这是判断题内容
答案：正确

---
```

### 2. 合并 TXT 文件 (`merge_txt.js`)

将目录中的所有 TXT 题库文件合并到一个汇总文件中。

**使用方法：**

```bash
node scripts/merge_txt.js [输出文件路径] [源目录路径]
```

**参数说明：**

- `-o, --output`: 指定输出文件路径
- `-d, --dir`: 指定源目录路径（默认为当前目录）

**示例：**

```bash
# 合并当前目录下的所有 TXT 文件
node scripts/merge_txt.js

# 指定输出文件
node scripts/merge_txt.js -o 题库汇总.txt

# 指定源目录和输出文件
node scripts/merge_txt.js -o 汇总.txt -d ./题库目录
```

**输出格式：**

```
============================================================
# 文件名1
============================================================

[文件1内容]

============================================================
# 文件名2
============================================================

[文件2内容]
```

### 3. 检查重复题目 (`check_duplicates.js`)

检查题库文件中是否存在重复的题目（基于题目内容，不考虑答案）。

**使用方法：**

```bash
node scripts/check_duplicates.js <题库文件路径>
```

**示例：**

```bash
node scripts/check_duplicates.js 题库汇总.txt
```

**输出示例：**

```
📖 正在解析文件: 题库汇总.txt

📊 共解析到 100 道题目

⚠️  发现 5 组重复题目：

================================================================================

【重复组 1】出现 3 次
题型: 单选题
题目: 这是重复的题目内容...
出现位置:
  1. 第 10 题 - 答案: A
  2. 第 25 题 - 答案: B
  3. 第 50 题 - 答案: A
```

### 4. 去除重复题目 (`remove_duplicates.js`)

去除题库文件中题目和答案都完全相同的重复项。

**使用方法：**

```bash
node scripts/remove_duplicates.js <题库文件路径> [输出文件路径]
```

**示例：**

```bash
# 使用默认输出路径（原文件名_去重.txt）
node scripts/remove_duplicates.js 题库汇总.txt

# 指定输出路径
node scripts/remove_duplicates.js 题库汇总.txt 去重后的题库.txt
```

**输出示例：**

```
📖 正在解析文件: 题库汇总.txt

📊 共解析到 100 道题目

⚠️  删除重复题目 #25 (与 #10 重复)
⚠️  删除重复题目 #50 (与 #10 重复)

================================================================================
✅ 去重完成！
📄 输入文件: 题库汇总.txt
📄 输出文件: 题库汇总_去重.txt
📊 原始题目数: 100
📊 去重后题目数: 98
📊 删除重复题目数: 2
📊 保留率: 98.00%
```

### 5. 浏览器搜索脚本 (`qs.js`)

Tampermonkey 用户脚本，用于在网页上搜索题库内容。

**安装步骤：**

1. 安装 [Tampermonkey](https://www.tampermonkey.net/) 浏览器扩展
2. 打开 Tampermonkey 管理面板
3. 创建新脚本，将 `scripts/qs.js` 的内容复制进去
4. 在脚本中找到 `QUESTION_BANK_CONTENT` 变量，将题库汇总 TXT 文件的内容粘贴进去
5. 保存脚本

**使用方法：**

1. 在任意网页上按反引号键 `` ` `` 或点击右上角的 `+` 按钮打开搜索面板
2. 在搜索框中输入关键词或正则表达式
3. 勾选"正则匹配"选项可使用正则表达式搜索
4. 点击"搜索"按钮或按 Enter 键执行搜索

**功能特性：**

- 🔍 支持关键词搜索和正则表达式搜索
- 📋 题目导航功能（获取页面题目并快速切换）
- 🎨 可自定义面板样式（宽度、高度、背景色、主题色）
- 🖱️ 支持拖拽移动面板位置
- ⌨️ 快捷键支持（反引号键切换显隐）

**题目导航功能：**

- 点击 `G` 按钮获取当前页面的题目列表
- 使用 `-` 和 `+` 按钮切换上一题/下一题
- 在输入框中输入题号并回车可跳转到指定题目

## 工作流程示例

### 完整的工作流程

```bash
# 1. 将多个 Excel 文件转换为 TXT
node scripts/excel_to_txt_universal.js 题库1.xlsx
node scripts/excel_to_txt_universal.js 题库2.xlsx
node scripts/excel_to_txt_universal.js 题库3.xlsx

# 2. 合并所有 TXT 文件
node scripts/merge_txt.js -o 题库汇总.txt

# 3. 检查重复题目
node scripts/check_duplicates.js 题库汇总.txt

# 4. 去除重复题目
node scripts/remove_duplicates.js 题库汇总.txt 题库汇总_去重.txt

# 5. 将去重后的文件内容复制到 qs.js 脚本的 QUESTION_BANK_CONTENT 变量中
```

## 项目结构

```
quez-bank-tool/
├── scripts/
│   ├── excel_to_txt_universal.js  # Excel 转 TXT 转换脚本
│   ├── merge_txt.js                # TXT 文件合并脚本
│   ├── check_duplicates.js         # 重复题目检查脚本
│   ├── remove_duplicates.js        # 去重脚本
│   └── qs.js                       # Tampermonkey 浏览器脚本
├── package.json                    # 项目配置文件
└── README.md                       # 项目说明文档
```

## 依赖项

- `xlsx`: ^0.18.5 - 用于读取和解析 Excel 文件

## 注意事项

1. **Excel 文件格式**：确保 Excel 文件的第一行为表头，包含必要的列名（如"题目"、"答案"等）
2. **TXT 文件格式**：所有脚本都基于标准的 TXT 题库格式，使用 `---` 作为题目分隔符
3. **编码格式**：所有文件使用 UTF-8 编码
4. **浏览器脚本**：`qs.js` 需要在 Tampermonkey 环境中运行，并需要手动填入题库内容

## 许可证

MIT License

## 贡献

欢迎提交 Issue 和 Pull Request！

