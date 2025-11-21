// ==UserScript==
// @name         quez-bank-tool
// @namespace    http://tampermonkey.net/
// @version      2.0.0
// @description  在页面上添加题库搜索面板，支持正则匹配搜索题库内容
// @description  ～ 键切换显隐，点击空白处隐藏，顶部白条支持拖拽移动面板，支持设置面板宽度、高度、背景色、主题色
// @description  支持搜索框输入关键词或正则表达式搜索题库内容，支持搜索选项，支持搜索答案
// @description  支持题目导航，支持上一题、下一题、跳转到指定题目。通过 G 按钮获取题目，782 行 selector。
// @match        *://*/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function () {
  "use strict";

  // ============================================
  // 题库内容：请将题库汇总.txt的内容粘贴到这里 格式如下
  // ============================================
  const QUESTION_BANK_CONTENT = `
  `;

  // 题库数据存储
  let questionBank = [];

  // 题目导航数据存储
  let questionTexts = [];
  let currentQuestionIndex = -1;

  // 拖拽相关变量
  let isDragging = false;
  let dragOffset = { x: 0, y: 0 };

  // 设置相关变量
  let isSettingsOpen = false;
  const defaultSettings = {
    width: 310,
    height: 400,
    backgroundColor: "#ffffff",
    themeColor: "#3070B8",
  };

  // 从localStorage加载设置
  function loadSettings() {
    const saved = localStorage.getItem("questionSearchSettings");
    return saved ? { ...defaultSettings, ...JSON.parse(saved) } : defaultSettings;
  }

  // 保存设置到localStorage
  function saveSettings(settings) {
    localStorage.setItem("questionSearchSettings", JSON.stringify(settings));
  }

  let currentSettings = loadSettings();

  // 创建样式
  const style = document.createElement("style");
  style.textContent = `
    #question-search-container {
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 10000;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    }

    #question-search-panel {
      visibility: hidden;
      opacity: 0;
      border-radius: 8px;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
      overflow: hidden;
      position: relative;
      display: flex;
      flex-direction: column;
    }

    #question-search-panel.visible {
      visibility: visible;
      opacity: 1;
    }

    .toggle-btn {
      position: fixed;
      top: 20px;
      right: 20px;
      width: 32px;
      height: 32px;
      background: transparent;
      border: none;
      font-size: 24px;
      color: #595959;
      cursor: pointer;
      z-index: 10001;
      display: flex;
      align-items: center;
      justify-content: center;
      user-select: none;
      padding: 0;
      line-height: 1;
    }

    .drag-handle {
      width: 100%;
      height: 24px;
      background: #f5f5f5;
      border-bottom: 1px solid #e8e8e8;
      cursor: move;
      user-select: none;
      display: flex;
      align-items: center;
      justify-content: center;
      position: relative;
      flex-shrink: 0;
    }

    .drag-handle:active {
      cursor: grabbing;
      background: #ebebeb;
    }

    .drag-handle::before {
      content: '';
      width: 40px;
      height: 4px;
      background: #d9d9d9;
      border-radius: 2px;
    }

    .drag-handle:hover::before {
      background: #bfbfbf;
    }

    .search-controls {
      padding: 16px;
      border-bottom: 1px solid #e8e8e8;
      background: transparent;
    }

    .search-input-group {
      display: flex;
      gap: 8px;
      margin-bottom: 12px;
    }

    .search-input {
      flex: 1;
      padding: 8px 12px;
      border: 1px solid #d9d9d9;
      border-radius: 4px;
      font-size: 14px;
      outline: none;
      user-select: text;
      pointer-events: auto;
    }

    .search-input:focus {
      border-color: var(--theme-color, #1890ff);
    }

    .search-btn {
      padding: 8px 16px;
      background: var(--theme-color, #3070B8);
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 14px;
      user-select: none;
      pointer-events: auto;
    }

    .search-btn:hover {
      background: var(--theme-color-hover, #4a85c7);
      filter: brightness(1.1);
    }

    .search-options {
      display: flex;
      gap: 12px;
      align-items: center;
    }

    .checkbox-group {
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .checkbox-group input[type="checkbox"] {
      cursor: pointer;
      user-select: none;
      pointer-events: auto;
    }

    .checkbox-group label {
      font-size: 13px;
      color: #595959;
      cursor: pointer;
      user-select: none;
      pointer-events: auto;
    }

    .load-status-text {
      font-size: 13px;
      color: #8c8c8c;
      margin-left: 8px;
    }

    .search-results {
      flex: 1;
      overflow-y: auto;
      padding: 16px;
      background: transparent;
    }

    .result-count {
      margin-bottom: 12px;
      font-size: 13px;
      color: #8c8c8c;
    }

    .question-item {
      padding: 12px;
      border: 1px solid #e8e8e8;
      border-radius: 4px;
      margin-bottom: 12px;
      background: transparent;
    }

    .question-item:hover {
      border-color: #1890ff;
      box-shadow: 0 2px 8px rgba(24, 144, 255, 0.1);
    }

    .question-type {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 2px;
      font-size: 12px;
      font-weight: 500;
      margin-bottom: 8px;
    }

    .question-type.单选,
    .question-type.多选 {
      background: #e6f7ff;
      color: #1890ff;
    }

    .question-type.判断 {
      background: #fff7e6;
      color: #fa8c16;
    }

    .question-text {
      font-size: 14px;
      color: #262626;
      line-height: 1.6;
      margin-bottom: 8px;
      white-space: pre-wrap;
    }

    .question-options {
      margin: 8px 0;
      padding-left: 16px;
    }

    .question-option {
      font-size: 13px;
      color: #595959;
      margin: 4px 0;
      line-height: 1.5;
    }

    .question-answer {
      margin-top: 8px;
      padding-top: 8px;
      border-top: 1px solid #e8e8e8;
      font-size: 13px;
    }

    .answer-label {
      font-weight: 500;
      color: #262626;
    }

    .answer-value {
      color: #52c41a;
      font-weight: 500;
    }

    .highlight {
      background: #fffbe6;
      padding: 2px 4px;
      border-radius: 2px;
      font-weight: 500;
    }

    .no-results {
      text-align: center;
      padding: 40px 20px;
      color: #8c8c8c;
    }

    .no-results-icon {
      font-size: 48px;
      margin-bottom: 16px;
    }

    .question-navigation {
      padding: 12px;
      background: transparent;
      border: 1px solid #e8e8e8;
      border-radius: 4px;
      margin-bottom: 12px;
    }

    .question-nav-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
    }

    .question-nav-title {
      font-size: 14px;
      font-weight: 500;
      color: #262626;
    }

    .question-status {
      font-size: 12px;
      color: #8c8c8c;
    }

    .question-nav-controls {
      display: flex;
      gap: 8px;
      align-items: center;
      flex-wrap: wrap;
    }

    .nav-btn {
      padding: 6px 12px;
      background: var(--theme-color, #3070B8);
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 13px;
      user-select: none;
      pointer-events: auto;
    }

    .nav-btn:hover {
      background: var(--theme-color-hover, #4a85c7);
      filter: brightness(1.1);
    }

    .nav-btn:disabled {
      background: #d9d9d9;
      cursor: not-allowed;
    }

    .nav-btn.fetch-btn {
      background: var(--theme-color, #3070B8);
    }

    .nav-btn.fetch-btn:hover {
      background: var(--theme-color-hover, #4a85c7);
      filter: brightness(1.1);
    }

    .jump-input {
      width: 60px;
      padding: 4px 8px;
      border: 1px solid #d9d9d9;
      border-radius: 4px;
      font-size: 13px;
      outline: none;
      text-align: center;
      user-select: text;
      pointer-events: auto;
    }

    .jump-input:focus {
      border-color: var(--theme-color, #1890ff);
    }

    .settings-btn {
      position: absolute;
      top: 8px;
      right: 8px;
      width: 28px;
      height: 28px;
      background: var(--theme-color, #3070B8);
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 16px;
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10001;
      padding: 0;
      user-select: none;
      pointer-events: auto;
    }

    .settings-btn:hover {
      background: var(--theme-color-hover, #4a85c7);
      filter: brightness(1.1);
    }

    .settings-panel {
      position: absolute;
      top: 40px;
      right: 8px;
      background: white;
      border: 1px solid #e8e8e8;
      border-radius: 8px;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
      padding: 16px;
      width: 80%;
      height: 80%;
      overflow: auto;
      z-index: 10002;
      display: none;
    }

    .settings-panel.open {
      display: block;
    }

    .settings-title {
      font-size: 16px;
      font-weight: 500;
      color: #262626;
      margin-bottom: 16px;
    }

    .settings-group {
      margin-bottom: 16px;
    }

    .settings-label {
      display: block;
      font-size: 13px;
      color: #595959;
      margin-bottom: 6px;
    }

    .settings-input {
      width: 100%;
      padding: 6px 10px;
      border: 1px solid #d9d9d9;
      border-radius: 4px;
      font-size: 13px;
      outline: none;
      box-sizing: border-box;
      user-select: text;
      pointer-events: auto;
    }

    .settings-input:focus {
      border-color: var(--theme-color, #3070B8);
    }

    .settings-input-group {
      display: flex;
      gap: 8px;
    }

    .settings-input-group .settings-input {
      flex: 1;
    }
  `;
  document.head.appendChild(style);

  // 面板显隐状态
  let isPanelVisible = false;

  // 切换面板显隐
  function togglePanel() {
    isPanelVisible = !isPanelVisible;
    if (isPanelVisible) {
      panel.classList.add("visible");
    } else {
      panel.classList.remove("visible");
    }
  }

  // 创建容器
  const container = document.createElement("div");
  container.id = "question-search-container";

  // 创建切换按钮
  const toggleBtn = document.createElement("button");
  toggleBtn.className = "toggle-btn";
  toggleBtn.textContent = "+";
  toggleBtn.title = "显示/隐藏面板 (Alt+C)";
  toggleBtn.onclick = (e) => {
    e.stopPropagation();
    togglePanel();
  };

  // 创建面板
  const panel = document.createElement("div");
  panel.id = "question-search-panel";
  panel.onclick = (e) => {
    e.stopPropagation();
  };

  // 应用设置到面板
  function applySettings(settings) {
    panel.style.width = `${settings.width}px`;
    panel.style.height = settings.height === "auto" ? "auto" : `${settings.height}px`;
    panel.style.maxHeight = "800px";
    panel.style.background = settings.backgroundColor;

    // 应用主题色
    if (settings.themeColor) {
      const root = document.documentElement;
      root.style.setProperty("--theme-color", settings.themeColor);
      // 计算hover颜色（稍微亮一点）
      const rgb = hexToRgb(settings.themeColor);
      if (rgb) {
        const hoverRgb = {
          r: Math.min(255, rgb.r + 20),
          g: Math.min(255, rgb.g + 20),
          b: Math.min(255, rgb.b + 20),
        };
        const hoverColor = `rgb(${hoverRgb.r}, ${hoverRgb.g}, ${hoverRgb.b})`;
        root.style.setProperty("--theme-color-hover", hoverColor);
      }
    }

    currentSettings = settings;
    saveSettings(settings);
  }

  // 辅助函数：将十六进制颜色转换为RGB
  function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
      ? {
          r: parseInt(result[1], 16),
          g: parseInt(result[2], 16),
          b: parseInt(result[3], 16),
        }
      : null;
  }

  // 初始化应用设置
  applySettings(currentSettings);

  // 创建拖拽条
  const dragHandle = document.createElement("div");
  dragHandle.className = "drag-handle";
  dragHandle.title = "拖拽移动面板";

  // 拖拽功能实现
  function initDrag() {
    dragHandle.addEventListener("mousedown", (e) => {
      isDragging = true;
      const rect = container.getBoundingClientRect();
      dragOffset.x = e.clientX - rect.left;
      dragOffset.y = e.clientY - rect.top;

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);

      e.preventDefault();
    });
  }

  function handleMouseMove(e) {
    if (!isDragging) return;

    const x = e.clientX - dragOffset.x;
    const y = e.clientY - dragOffset.y;

    // 限制在视口内
    const maxX = window.innerWidth - container.offsetWidth;
    const maxY = window.innerHeight - container.offsetHeight;

    container.style.left = `${Math.max(0, Math.min(x, maxX))}px`;
    container.style.top = `${Math.max(0, Math.min(y, maxY))}px`;
    container.style.right = "auto";
  }

  function handleMouseUp() {
    isDragging = false;
    document.removeEventListener("mousemove", handleMouseMove);
    document.removeEventListener("mouseup", handleMouseUp);
  }

  initDrag();

  // 创建设置按钮
  const settingsBtn = document.createElement("button");
  settingsBtn.className = "settings-btn";
  settingsBtn.textContent = "⚙";
  settingsBtn.title = "设置";
  settingsBtn.onclick = (e) => {
    e.stopPropagation();
    isSettingsOpen = !isSettingsOpen;
    settingsPanel.classList.toggle("open", isSettingsOpen);
  };

  // 创建设置面板
  const settingsPanel = document.createElement("div");
  settingsPanel.className = "settings-panel";
  settingsPanel.onclick = (e) => {
    e.stopPropagation();
  };

  const settingsTitle = document.createElement("div");
  settingsTitle.className = "settings-title";
  settingsTitle.textContent = "面板设置";

  // 宽度设置
  const widthGroup = document.createElement("div");
  widthGroup.className = "settings-group";
  const widthLabel = document.createElement("label");
  widthLabel.className = "settings-label";
  widthLabel.textContent = "宽度 (px)";
  const widthInput = document.createElement("input");
  widthInput.type = "number";
  widthInput.className = "settings-input";
  widthInput.value = currentSettings.width;
  widthInput.min = 300;
  widthInput.max = 800;
  widthGroup.appendChild(widthLabel);
  widthGroup.appendChild(widthInput);

  // 高度设置
  const heightGroup = document.createElement("div");
  heightGroup.className = "settings-group";
  const heightLabel = document.createElement("label");
  heightLabel.className = "settings-label";
  heightLabel.textContent = "高度 (px, 不输入则为 auto)";
  const heightInput = document.createElement("input");
  heightInput.type = "number";
  heightInput.className = "settings-input";
  heightInput.value = currentSettings.height === "auto" ? "" : currentSettings.height;
  heightInput.placeholder = "300-800 或留空为 auto";
  heightInput.min = 300;
  heightInput.max = 800;
  heightGroup.appendChild(heightLabel);
  heightGroup.appendChild(heightInput);

  // 背景色设置
  const bgColorGroup = document.createElement("div");
  bgColorGroup.className = "settings-group";
  const bgColorLabel = document.createElement("label");
  bgColorLabel.className = "settings-label";
  bgColorLabel.textContent = "背景色";
  const bgColorInput = document.createElement("input");
  bgColorInput.type = "color";
  bgColorInput.className = "settings-input";
  bgColorInput.value = currentSettings.backgroundColor;
  bgColorGroup.appendChild(bgColorLabel);
  bgColorGroup.appendChild(bgColorInput);

  // 主题色设置
  const themeColorGroup = document.createElement("div");
  themeColorGroup.className = "settings-group";
  const themeColorLabel = document.createElement("label");
  themeColorLabel.className = "settings-label";
  themeColorLabel.textContent = "主题色";
  const themeColorInput = document.createElement("input");
  themeColorInput.type = "color";
  themeColorInput.className = "settings-input";
  themeColorInput.value = currentSettings.themeColor || defaultSettings.themeColor;
  themeColorGroup.appendChild(themeColorLabel);
  themeColorGroup.appendChild(themeColorInput);

  // 应用按钮
  const applyBtn = document.createElement("button");
  applyBtn.className = "nav-btn";
  applyBtn.textContent = "应用";
  applyBtn.style.width = "100%";
  applyBtn.onclick = (e) => {
    e.stopPropagation();
    let width = parseInt(widthInput.value, 10) || defaultSettings.width;
    width = Math.max(300, Math.min(800, width)); // 限制在300-800之间

    let height;
    if (heightInput.value === "" || heightInput.value === null || heightInput.value === undefined) {
      height = "auto";
    } else {
      height = parseInt(heightInput.value, 10);
      if (isNaN(height)) {
        height = "auto";
      } else {
        height = Math.max(300, Math.min(800, height)); // 限制在300-800之间
      }
    }

    const newSettings = {
      width: width,
      height: height,
      backgroundColor: bgColorInput.value || defaultSettings.backgroundColor,
      themeColor: themeColorInput.value || defaultSettings.themeColor,
    };
    applySettings(newSettings);
    isSettingsOpen = false;
    settingsPanel.classList.remove("open");
  };

  settingsPanel.appendChild(settingsTitle);
  settingsPanel.appendChild(widthGroup);
  settingsPanel.appendChild(heightGroup);
  settingsPanel.appendChild(bgColorGroup);
  settingsPanel.appendChild(themeColorGroup);
  settingsPanel.appendChild(applyBtn);

  panel.appendChild(settingsBtn);
  panel.appendChild(settingsPanel);

  // 创建搜索控制区
  const controls = document.createElement("div");
  controls.className = "search-controls";

  // 创建题目导航工具
  const questionNav = document.createElement("div");
  questionNav.className = "question-navigation";

  const navHeader = document.createElement("div");
  navHeader.className = "question-nav-header";

  const navTitle = document.createElement("div");
  navTitle.className = "question-nav-title";
  navTitle.textContent = "题目导航";

  const questionStatus = document.createElement("div");
  questionStatus.className = "question-status";
  questionStatus.textContent = "未获取题目";

  navHeader.appendChild(navTitle);
  navHeader.appendChild(questionStatus);

  const navControls = document.createElement("div");
  navControls.className = "question-nav-controls";

  const fetchBtn = document.createElement("button");
  fetchBtn.className = "nav-btn fetch-btn";
  fetchBtn.textContent = "G";

  const prevBtn = document.createElement("button");
  prevBtn.className = "nav-btn";
  prevBtn.textContent = "-";
  prevBtn.disabled = true;

  const jumpInput = document.createElement("input");
  jumpInput.type = "number";
  jumpInput.className = "jump-input";
  jumpInput.placeholder = "1";
  jumpInput.min = "1";
  jumpInput.disabled = true;

  const nextBtn = document.createElement("button");
  nextBtn.className = "nav-btn";
  nextBtn.textContent = "+";
  nextBtn.disabled = true;

  navControls.appendChild(fetchBtn);
  navControls.appendChild(prevBtn);
  navControls.appendChild(jumpInput);
  navControls.appendChild(nextBtn);

  questionNav.appendChild(navHeader);
  questionNav.appendChild(navControls);

  // 获取题目函数
  function fetchQuestions() {
    try {
      // selectors 选择器
      const nodes = document.querySelectorAll(
        'li[name="li_Question"] .col-18 > div[style*="overflow"]'
      );
      questionTexts = Array.from(nodes)
        .map((node) => node.innerText.replace(/\s+/g, " ").trim())
        .filter((text) => text.length > 0);

      if (questionTexts.length === 0) {
        questionStatus.textContent = "未找到题目";
        questionStatus.style.color = "#ff4d4f";
        prevBtn.disabled = true;
        nextBtn.disabled = true;
        jumpInput.disabled = true;
        return;
      }

      currentQuestionIndex = 0;
      updateQuestionStatus();
      applyQuestionToSearch(0);

      prevBtn.disabled = false;
      nextBtn.disabled = false;
      jumpInput.disabled = false;
      jumpInput.max = questionTexts.length;

      questionStatus.style.color = "#389e0d";
    } catch (error) {
      questionStatus.textContent = `获取失败: ${error.message}`;
      questionStatus.style.color = "#ff4d4f";
    }
  }

  // 更新题目状态显示
  function updateQuestionStatus() {
    if (questionTexts.length === 0) {
      questionStatus.textContent = "未获取题目";
      return;
    }
    questionStatus.textContent = `${currentQuestionIndex + 1} / ${questionTexts.length}`;
  }

  // 应用题目到搜索框并搜索
  function applyQuestionToSearch(targetIndex) {
    if (questionTexts.length === 0) {
      return;
    }

    // 支持循环：使用模运算
    const normalizedIndex =
      ((targetIndex % questionTexts.length) + questionTexts.length) % questionTexts.length;
    currentQuestionIndex = normalizedIndex;

    // 将题目文本填入搜索框
    searchInput.value = questionTexts[currentQuestionIndex];

    // 更新状态显示
    updateQuestionStatus();

    // 更新跳转输入框
    jumpInput.value = currentQuestionIndex + 1;

    // 执行搜索
    performSearch();
  }

  // 上一题
  function goToPreviousQuestion() {
    if (questionTexts.length === 0) {
      questionStatus.textContent = "请先获取题目";
      questionStatus.style.color = "#ff4d4f";
      return;
    }
    applyQuestionToSearch(currentQuestionIndex - 1);
  }

  // 下一题
  function goToNextQuestion() {
    if (questionTexts.length === 0) {
      questionStatus.textContent = "请先获取题目";
      questionStatus.style.color = "#ff4d4f";
      return;
    }
    applyQuestionToSearch(currentQuestionIndex + 1);
  }

  // 跳转到指定题目
  function jumpToQuestion() {
    if (questionTexts.length === 0) {
      questionStatus.textContent = "请先获取题目";
      questionStatus.style.color = "#ff4d4f";
      return;
    }

    const targetNum = parseInt(jumpInput.value, 10);
    if (isNaN(targetNum) || targetNum < 1 || targetNum > questionTexts.length) {
      questionStatus.textContent = `请输入 1-${questionTexts.length} 之间的数字`;
      questionStatus.style.color = "#ff4d4f";
      setTimeout(() => {
        updateQuestionStatus();
        questionStatus.style.color = "#8c8c8c";
      }, 2000);
      return;
    }

    applyQuestionToSearch(targetNum - 1);
  }

  // 绑定事件
  fetchBtn.onclick = fetchQuestions;
  prevBtn.onclick = goToPreviousQuestion;
  nextBtn.onclick = goToNextQuestion;
  jumpInput.onkeypress = (e) => {
    if (e.key === "Enter") {
      jumpToQuestion();
    }
  };
  jumpInput.onblur = () => {
    // 失去焦点时也触发跳转
    if (jumpInput.value) {
      jumpToQuestion();
    }
  };

  // 搜索输入组
  const inputGroup = document.createElement("div");
  inputGroup.className = "search-input-group";
  const searchInput = document.createElement("input");
  searchInput.type = "text";
  searchInput.className = "search-input";
  searchInput.placeholder = "输入关键词或正则表达式搜索...";
  searchInput.onkeypress = (e) => {
    if (e.key === "Enter") {
      performSearch();
    }
  };
  const searchBtn = document.createElement("button");
  searchBtn.className = "search-btn";
  searchBtn.textContent = "搜索";
  searchBtn.onclick = performSearch;
  inputGroup.appendChild(searchInput);
  inputGroup.appendChild(searchBtn);

  // 搜索选项
  const options = document.createElement("div");
  options.className = "search-options";
  const regexCheckbox = document.createElement("div");
  regexCheckbox.className = "checkbox-group";
  const regexInput = document.createElement("input");
  regexInput.type = "checkbox";
  regexInput.id = "regex-mode";
  regexInput.checked = false;
  const regexLabel = document.createElement("label");
  regexLabel.htmlFor = "regex-mode";
  regexLabel.textContent = "正则匹配";
  regexCheckbox.appendChild(regexInput);
  regexCheckbox.appendChild(regexLabel);

  // 加载状态文本
  const loadStatusText = document.createElement("span");
  loadStatusText.className = "load-status-text";
  if (QUESTION_BANK_CONTENT.trim()) {
    questionBank = parseQuestionBank(QUESTION_BANK_CONTENT);
    loadStatusText.textContent = `已加载 ${questionBank.length} 道题目`;
  } else {
    loadStatusText.textContent = "未加载题库";
  }

  options.appendChild(regexCheckbox);
  options.appendChild(loadStatusText);
  controls.appendChild(questionNav);
  controls.appendChild(inputGroup);
  controls.appendChild(options);

  // 创建结果区域
  const results = document.createElement("div");
  results.className = "search-results";
  const resultCount = document.createElement("div");
  resultCount.className = "result-count";
  results.appendChild(resultCount);

  // 组装面板（拖拽条在最前面）
  panel.appendChild(dragHandle);
  panel.appendChild(controls);
  panel.appendChild(results);

  // 组装容器
  container.appendChild(panel);

  // 添加到页面
  document.body.appendChild(container);
  document.body.appendChild(toggleBtn);

  // 键盘快捷键 ` 切换显隐
  document.addEventListener("keydown", (e) => {
    // 反引号键 ` (兼容 Mac 和 Windows)
    const isBackquote =
      e.key === "Backquote" ||
      e.key === "`" ||
      e.code === "Backquote" ||
      (e.keyCode === 192 && !e.shiftKey);

    if (isBackquote && !e.ctrlKey && !e.shiftKey && !e.altKey && !e.metaKey) {
      // 如果焦点在输入框中，不触发快捷键
      const activeElement = document.activeElement;
      if (
        activeElement &&
        (activeElement.tagName === "INPUT" || activeElement.tagName === "TEXTAREA")
      ) {
        return;
      }
      e.preventDefault();
      togglePanel();
    }
  });

  // 点击外部区域隐藏面板
  document.addEventListener("click", (e) => {
    // 如果面板不可见，不处理
    if (!isPanelVisible) {
      return;
    }

    // 如果点击的是切换按钮，不处理（由按钮自己的点击事件处理）
    if (e.target === toggleBtn || toggleBtn.contains(e.target)) {
      return;
    }

    // 如果点击的是面板内部，不处理
    if (panel.contains(e.target) || container.contains(e.target)) {
      return;
    }

    // 点击的是外部区域，隐藏面板
    togglePanel();
  });

  // 解析题库文件
  function parseQuestionBank(content) {
    const questions = [];
    const blocks = content.split(/\n---\n/);

    for (const block of blocks) {
      const lines = block
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => l);
      if (lines.length === 0) continue;

      let questionType = "";
      let question = "";
      let answer = "";
      const options = { A: "", B: "", C: "", D: "", E: "", F: "" };

      let i = 0;

      // 解析题型
      if (lines[i] && lines[i].startsWith("# ")) {
        questionType = lines[i].substring(2).trim();
        i++;
      }

      // 解析题目
      if (lines[i] && lines[i].startsWith("题目：")) {
        question = lines[i].substring(3).trim();
        i++;
      }

      // 解析选项（选择题）
      const isChoice = questionType.includes("单选") || questionType.includes("多选");
      if (isChoice) {
        while (i < lines.length) {
          if (lines[i].startsWith("答案：")) {
            answer = lines[i].substring(3).trim();
            i++;
            break;
          }
          const optionMatch = lines[i].match(/^([A-F])\.\s*(.+)$/);
          if (optionMatch) {
            const label = optionMatch[1];
            const text = optionMatch[2];
            if (options.hasOwnProperty(label)) {
              options[label] = text;
            }
            i++;
          } else {
            question += "\n" + lines[i];
            i++;
          }
        }
      } else {
        // 判断题
        for (let j = i; j < lines.length; j++) {
          if (lines[j].startsWith("答案：")) {
            answer = lines[j].substring(3).trim();
            break;
          }
          if (!lines[j].startsWith("答案：")) {
            question += (question ? "\n" : "") + lines[j];
          }
        }
      }

      if (question && answer) {
        questions.push({
          type: questionType || "题目",
          question: question,
          answer: answer,
          options: options,
        });
      }
    }

    return questions;
  }

  // 执行搜索
  function performSearch() {
    const query = searchInput.value.trim();
    if (!query) {
      resultCount.textContent = "请输入搜索关键词";
      results.innerHTML = "";
      results.appendChild(resultCount);
      return;
    }

    if (questionBank.length === 0) {
      resultCount.textContent = "请在脚本中填写 QUESTION_BANK_CONTENT 变量";
      results.innerHTML = "";
      results.appendChild(resultCount);
      return;
    }

    const useRegex = regexInput.checked;
    let matches = [];

    try {
      const pattern = useRegex
        ? new RegExp(query, "i")
        : new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");

      for (const q of questionBank) {
        let matched = false;
        let matchText = "";

        // 搜索题目
        if (pattern.test(q.question)) {
          matched = true;
          matchText = q.question;
        }

        // 搜索选项
        for (const [label, text] of Object.entries(q.options)) {
          if (text && pattern.test(text)) {
            matched = true;
            matchText = text;
          }
        }

        // 搜索答案
        if (pattern.test(q.answer)) {
          matched = true;
          matchText = q.answer;
        }

        if (matched) {
          matches.push({ ...q, matchText });
        }
      }
    } catch (error) {
      resultCount.textContent = `正则表达式错误: ${error.message}`;
      results.innerHTML = "";
      results.appendChild(resultCount);
      return;
    }

    // 显示结果
    resultCount.textContent = `找到 ${matches.length} 道匹配的题目`;
    results.innerHTML = "";
    results.appendChild(resultCount);

    if (matches.length === 0) {
      const noResults = document.createElement("div");
      noResults.className = "no-results";
      noResults.innerHTML = `
        <div>未找到匹配的题目</div>
      `;
      results.appendChild(noResults);
      return;
    }

    // 高亮函数
    const highlight = (text, pattern) => {
      if (!text) return "";
      const regex = useRegex
        ? new RegExp(`(${pattern})`, "gi")
        : new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi");
      return text.replace(regex, '<span class="highlight">$1</span>');
    };

    // 渲染题目
    for (const match of matches) {
      const item = document.createElement("div");
      item.className = "question-item";

      const typeSpan = document.createElement("div");
      typeSpan.className = `question-type ${match.type}`;
      typeSpan.textContent = match.type;

      const questionDiv = document.createElement("div");
      questionDiv.className = "question-text";
      questionDiv.innerHTML = highlight(match.question, query);

      item.appendChild(typeSpan);
      item.appendChild(questionDiv);

      // 显示选项（如果有）
      const hasOptions = Object.values(match.options).some((opt) => opt);
      if (hasOptions) {
        const optionsDiv = document.createElement("div");
        optionsDiv.className = "question-options";
        for (const [label, text] of Object.entries(match.options)) {
          if (text) {
            const optionDiv = document.createElement("div");
            optionDiv.className = "question-option";
            optionDiv.innerHTML = `<strong>${label}.</strong> ${highlight(text, query)}`;
            optionsDiv.appendChild(optionDiv);
          }
        }
        item.appendChild(optionsDiv);
      }

      // 显示答案
      const answerDiv = document.createElement("div");
      answerDiv.className = "question-answer";
      answerDiv.innerHTML = `<span class="answer-label">答案：</span><span class="answer-value">${highlight(
        match.answer,
        query
      )}</span>`;
      item.appendChild(answerDiv);

      results.appendChild(item);
    }
  }
})();
