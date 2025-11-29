# 投资看板 V9

一个基于 Vue 3 + Element Plus 的智能投资管理看板，支持 AI 图片识别、实时价格更新、持仓盈亏分析等功能。

## 🎉 新功能：后端价格服务

现已支持 Node.js 后端服务，使用 `yahoo-finance2` 库获取股票价格，提供：
- ✅ **智能缓存**：价格数据缓存 30 分钟，减少 API 调用
- ✅ **自动刷新**：后台定时检查并更新过期缓存
- ✅ **批量获取**：支持一次性获取多个股票价格
- ✅ **手动刷新**：点击按钮强制更新最新价格

### 快速启动后端服务

```bash
# 1. 安装依赖
npm install

# 2. (推荐) 配置 API Key 以提高成功率
export FINNHUB_KEY="your_key"  # 注册: https://finnhub.io/register

# 3. 启动后端服务
npm start

# 4. 启动前端（新开终端）
python3 -m http.server 8000
# 或使用 VS Code 的 Live Server

# 5. 测试后端服务（可选）
npm test
```

**重要提示**: 由于 Yahoo Finance API 经常出现 403 限流，强烈建议配置免费的 Finnhub API Key。
详细说明请查看 [API_KEY_SETUP.md](API_KEY_SETUP.md)

---

## 功能特性

- ✏️ **投资记录管理**：手动录入或 AI 识别截图自动录入
- 📊 **资产分布可视化**：饼图展示资产配置
- 💰 **持仓盈亏分析**：实时计算每个标的的盈亏情况
- 🔄 **实时价格更新**：从 Yahoo Finance 获取最新股价（支持后端缓存）
- 🙈 **隐私模式**：一键隐藏所有金额信息
- 🎨 **拖拽排序**：自定义卡片布局
- 🌐 **汇率自动更新**：支持 USD/CNY 实时汇率

## 项目结构

```
InvestLog/
├── index.html              # 主入口文件
├── server.js               # 🆕 后端价格服务
├── package.json            # 🆕 Node.js 依赖配置
├── test-server.js          # 🆕 后端服务测试脚本
├── START_SERVER.md         # 🆕 后端服务使用说明
├── src/
│   ├── styles/            # 样式文件
│   │   ├── base.css       # 基础样式（全局变量、布局）
│   │   ├── components.css # 组件样式（卡片、按钮、表格）
│   │   └── position.css   # 持仓盈亏专用样式（深色主题）
│   ├── utils/             # 工具函数
│   │   ├── storage.js     # 本地存储封装
│   │   ├── formatter.js   # 数据格式化工具
│   │   └── api.js         # 🔄 API 调用封装（已更新支持后端）
│   ├── composables/       # Vue Composables
│   │   ├── useConfig.js   # 配置管理（汇率、AI设置）
│   │   ├── useRecords.js  # 记录管理（增删改查、AI识别）
│   │   ├── usePosition.js # 🔄 持仓盈亏管理（已更新支持后端）
│   │   └── useChart.js    # 图表管理（ECharts初始化和更新）
│   └── app.js             # 主应用逻辑（整合所有模块）
└── README.md              # 项目说明
```

## 模块说明

### 样式模块 (styles/)

- **base.css**: 全局基础样式，包含 CSS 变量、body 样式、导航栏等
- **components.css**: 通用组件样式，如卡片、按钮、表格等
- **position.css**: 持仓盈亏模块专用样式，采用深色主题

### 工具模块 (utils/)

- **storage.js**: 封装 localStorage 操作，提供统一的存储接口
- **formatter.js**: 数据格式化工具，处理货币、日期等格式
- **api.js**: API 调用封装，包括汇率、股价、AI 识别等

### Composables (composables/)

- **useConfig.js**: 管理系统配置，包括汇率、AI 服务商设置
- **useRecords.js**: 管理投资记录，支持手动录入和 AI 识别
- **usePosition.js**: 管理持仓盈亏，计算成本、市值、收益率
- **useChart.js**: 管理 ECharts 图表，处理资产分布可视化

### 主应用 (app.js)

整合所有 composables，初始化 Vue 应用，处理生命周期和全局状态。

## 使用方法

### 1. 直接打开

在浏览器中打开 `index.html` 即可使用（需要网络连接以加载 CDN 资源）。

### 2. 本地服务器

推荐使用本地服务器运行，避免 CORS 问题：

```bash
# 使用 Python
python -m http.server 8000

# 使用 Node.js
npx serve .

# 使用 VS Code Live Server 插件
```

然后访问 `http://localhost:8000`

## 配置说明

### AI 识别配置

1. 点击右上角 ⚙️ 图标打开设置
2. 选择 AI 服务商（Google Gemini 或 OpenAI）
3. 填写 API Key 和模型名称
4. 保存配置

### 汇率配置

- 系统会自动获取最新汇率
- 也可以手动点击刷新按钮更新
- 汇率会自动保存到本地

## 数据存储

所有数据都存储在浏览器的 localStorage 中：

- `investData`: 投资记录
- `aiConfigV9`: AI 配置
- `stockPrices`: 股票价格缓存
- `lastUpdateTime`: 最后更新时间
- `cardOrder`: 卡片排序

## 修改指南

### 修改样式

- **全局样式**: 编辑 `src/styles/base.css`
- **组件样式**: 编辑 `src/styles/components.css`
- **持仓盈亏样式**: 编辑 `src/styles/position.css`

### 修改功能

- **配置相关**: 编辑 `src/composables/useConfig.js`
- **记录管理**: 编辑 `src/composables/useRecords.js`
- **持仓盈亏**: 编辑 `src/composables/usePosition.js`
- **图表显示**: 编辑 `src/composables/useChart.js`

### 添加新功能

1. 在 `src/composables/` 创建新的 composable
2. 在 `src/app.js` 中引入并使用
3. 在 `index.html` 中添加对应的 UI

## 技术栈

- **Vue 3**: 渐进式 JavaScript 框架
- **Element Plus**: Vue 3 组件库
- **ECharts**: 数据可视化库
- **Sortable.js**: 拖拽排序库
- **Yahoo Finance API**: 股票价格数据
- **Exchange Rate API**: 汇率数据

## 注意事项

1. **CORS 问题**: 某些 API 可能存在跨域限制，建议使用本地服务器运行
2. **API 限流**: Yahoo Finance API 有请求频率限制，刷新价格时会自动添加延迟
3. **数据安全**: 所有数据存储在本地，不会上传到服务器
4. **浏览器兼容**: 推荐使用现代浏览器（Chrome、Firefox、Safari、Edge）
5. **🔒 API Key 安全**: 
   - 后端 API Keys 使用环境变量配置，不要硬编码在代码中
   - 前端 AI API Key 由用户自行配置，存储在浏览器 localStorage
   - 部署前请阅读 [SECURITY.md](SECURITY.md) 了解安全最佳实践

## 部署到线上

### 准备工作

1. **检查安全配置**：阅读 [SECURITY.md](SECURITY.md)
2. **配置 API Keys**：
   - 后端：使用环境变量（不要提交到 Git）
   - 前端：用户在设置界面自行配置

### 推荐部署方案

**方案 1: 静态托管 + 本地后端（个人使用）**
- 前端部署到 Vercel/Netlify/GitHub Pages
- 后端在本地运行（API Keys 完全安全）

**方案 2: 全栈部署（团队使用）**
- 部署到 Vercel/Render/Railway 等云平台
- 在云平台控制台配置环境变量

详细说明请参考 [SECURITY.md](SECURITY.md)

## 许可证

MIT License