# 更新日志

## [2.2.0] - 2025-12-03

### 🗄️ 数据库重构

- **数据库架构优化**: 完全重构数据库设计，遵循单一数据源原则
  - 新增 `stocks` 表：独立管理股票信息，与交易记录解耦
  - 优化 `transactions` 表：移除冗余字段 `total`（通过 `price * shares` 计算）和 `name`（从 `stocks` 表关联）
  - 保留 `daily_price_snapshots` 作为唯一价格数据源
  - 优化 `daily_profits` 表：移除 `new_investment`（从 `transactions` 实时计算）和 `is_market_closed`（根据日期判断）
  - 移除冗余表：`price_cache`、`monthly_profits`、`yearly_profits`（改为实时计算）
  - 添加外键约束和索引，提升数据完整性和查询性能
  - 启用 WAL 模式，提高并发性能

### 📊 新增功能

- **总市值折线图**: 在「持仓盈亏」卡片顶部新增市值趋势图
  - 使用 ECharts 绘制渐变填充折线图
  - 显示从 2025-12-01 开始的总市值变化
  - 支持鼠标悬停查看具体数值
  - 新增 Composable: `src/composables/useMarketValueChart.js`
  - 新增 API: `GET /api/marketvalue/history`

- **收益日历**: 完整的月/年视图收益展示
  - 月视图：日历形式显示每日收益，周末标记为休市
  - 年视图：网格形式显示每月收益汇总
  - 支持月度汇总和年度汇总显示
  - 新增 Composable: `src/composables/useProfitCalendar.js`
  - 新增样式文件: `src/styles/profit-calendar.css`
  - 新增 API 套件：
    - `GET /api/profits/daily/:date` - 获取某日收益
    - `GET /api/profits/daily/month/:yearMonth` - 获取某月所有日收益
    - `GET /api/profits/monthly/:month` - 获取某月汇总
    - `GET /api/profits/monthly/year/:year` - 获取某年所有月收益
    - `GET /api/profits/yearly/:year` - 获取某年汇总
    - `POST /api/profits/calculate` - 手动计算收益
    - `POST /api/profits/recalculate` - 重新计算所有收益

### 🎨 UI/UX 优化

- **页面布局调整**:
  - 持仓盈亏卡片移至左侧顶部（`left-0`）
  - 收益日历卡片位于左侧第二位（`left-1`）
  - 资产分布卡片位于右侧顶部（`right-0`）
  - 交易记录卡片位于右侧第二位（`right-1`）

- **收益日历样式**:
  - 日历格子支持鼠标悬停效果
  - 休市日灰色背景标识
  - 正收益绿色，负收益红色
  - 响应式布局，支持移动端

### 📝 文档完善

- **新增数据库设计文档**: `DATABASE_DESIGN.md`
  - 详细的表结构说明和字段解释
  - 数据流转图和收益计算逻辑
  - 索引策略和性能优化建议
  - 数据迁移指南和常见查询示例
  - 备份恢复方案

### 🔧 后端 API 增强

- 新增价格快照管理 API：
  - `POST /api/prices/snapshot` - 手动保存价格快照
  
- 完善收益管理 API：
  - 支持按日、月、年查询收益
  - 支持收益重算和清空操作

- 优化定时任务：
  - 每天早上 7:00 自动刷新价格并保存快照
  - 从 2025-12-03 开始自动计算每日收益

### 🐛 Bug 修复

- 修复 HTML 中未引入 `useMarketValueChart.js` 的问题
- 优化收益计算逻辑，避免除零错误
- 修复月收益/年收益实时计算中的边界情况

### 🔧 技术改进

- 实现单一数据源原则，减少数据不一致风险
- 计算字段改为实时计算，降低存储冗余
- 优化数据库查询，添加复合索引
- 使用事务批处理提升批量操作性能
- 代码模块化，提升可维护性

---

## [2.1.0] - 2025-11-29

### ✨ 新增功能

- **弹框式记录**: 将「记一笔」改为二级弹框，界面更简洁
  - 移除了独立的记录表单卡片
  - 在「持仓明细」顶部添加「记一笔」按钮
  - 弹框内包含所有录入功能（手动输入 + AI 识别）
  - 预计股数提示更醒目

### 🔒 安全改进

- **API Key 安全检查**: 全面检查项目中的 API Key 使用
  - 后端使用环境变量管理 API Keys
  - 前端 AI API Key 由用户自行配置
  - 代码中无硬编码密钥
  
- **部署安全文档**: 新增 `SECURITY.md` 
  - API Key 管理最佳实践
  - 线上部署指南
  - 紧急响应流程
  - 安全审计清单

- **.gitignore 增强**:
  - 添加 `.env` 文件忽略
  - 添加配置文件忽略
  - 添加临时文件忽略

- **环境变量模板**: 新增 `.env.example`
  - 提供 API Keys 配置示例
  - 说明如何获取各个 API Key

### 🎨 UI 优化

- 「持仓明细」卡片移至顶部（原 left-0 位置）
- 「持仓盈亏」卡片调整为 left-1 位置
- 弹框样式优化，预计股数显示更清晰
- 「记一笔」按钮使用 primary 颜色，更突出

### 📝 文档更新

- 更新 `README.md` 添加部署和安全说明
- 新增 `SECURITY.md` 详细安全指南
- 新增 `.env.example` 环境变量模板

### 🐛 修复

- 修复卡片拖拽排序在删除卡片后可能出现的问题
- 添加卡片 ID 存在性检查

---

## [2.0.1] - 2025-11-28

### 🆕 后端价格服务

- 新增 Node.js 后端服务 (`server.js`)
- 支持多数据源：Yahoo Finance + Finnhub + Alpha Vantage
- 智能缓存机制（30分钟）
- 自动重试和容错

---

## [1.0.0] - 2025-11-27

### 🎉 首次发布

- Vue 3 + Element Plus 实现
- 投资记录管理
- AI 图片识别
- 资产分布可视化
- 持仓盈亏分析
- 隐私模式
- 拖拽排序
