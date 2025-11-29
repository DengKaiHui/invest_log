# 📋 部署检查清单

在部署到线上环境之前，请逐项检查以下内容。

---

## 🔐 安全检查

### 自动检查（推荐）

运行安全检查脚本：

```bash
./check-security.sh
```

### 手动检查清单

- [ ] **环境变量配置**
  - [ ] `.env` 文件已添加到 `.gitignore`
  - [ ] `.env` 文件未被 Git 跟踪（运行 `git ls-files | grep .env`）
  - [ ] 后端使用 `process.env` 读取 API Keys
  
- [ ] **代码审查**
  - [ ] 代码中无硬编码的 API Keys
  - [ ] 前端配置使用 localStorage（用户自行填写）
  - [ ] 所有敏感信息通过环境变量管理

- [ ] **Git 历史检查**
  - [ ] `.env` 文件未在 Git 历史中
  - [ ] 运行 `git log --all -- .env` 确认为空

- [ ] **文档完整性**
  - [ ] README.md 包含部署说明
  - [ ] SECURITY.md 包含安全指南
  - [ ] .env.example 提供配置模板

---

## 🚀 功能测试

### 本地测试

- [ ] **前端界面**
  - [ ] 页面正常加载
  - [ ] 「持仓明细」顶部显示「记一笔」按钮
  - [ ] 点击按钮弹出对话框
  - [ ] 对话框包含完整表单（资产名称、日期、金额、单价）
  - [ ] 对话框包含「截图识别」功能
  - [ ] 表单验证正常
  - [ ] 提交后数据显示在列表中

- [ ] **后端服务**
  - [ ] 运行 `npm start` 启动成功
  - [ ] 访问 `http://localhost:3001/api/health` 返回正常
  - [ ] 价格查询功能正常
  - [ ] 缓存机制工作正常

- [ ] **其他功能**
  - [ ] 持仓盈亏计算正确
  - [ ] 图表显示正常
  - [ ] 隐私模式切换正常
  - [ ] 卡片拖拽排序正常
  - [ ] 汇率更新正常

### 浏览器兼容性

- [ ] Chrome/Edge（最新版本）
- [ ] Firefox（最新版本）
- [ ] Safari（最新版本）
- [ ] 移动端浏览器

---

## 🌐 部署配置

### 方案 1: 静态托管 + 本地后端

**前端部署（Vercel/Netlify/GitHub Pages）:**

- [ ] 构建静态文件
- [ ] 上传到托管平台
- [ ] 配置自定义域名（可选）
- [ ] 测试访问

**后端（本地运行）:**

- [ ] 配置环境变量
  ```bash
  export FINNHUB_KEY="your_key"
  export ALPHA_VANTAGE_KEY="your_key"
  ```
- [ ] 运行 `npm start`
- [ ] 确认服务在 `http://localhost:3001` 运行

### 方案 2: 全栈部署（云平台）

**环境变量配置:**

云平台控制台设置：

- [ ] `FINNHUB_KEY` = your_finnhub_api_key
- [ ] `ALPHA_VANTAGE_KEY` = your_alphavantage_api_key
- [ ] `PORT` = 3001（可选）

**部署到 Vercel:**

- [ ] 创建 `vercel.json`（参考 SECURITY.md）
- [ ] 在控制台配置环境变量
- [ ] 运行 `vercel deploy`
- [ ] 测试生产环境

**部署到 Render:**

- [ ] 创建 `render.yaml`（参考 SECURITY.md）
- [ ] 在控制台配置环境变量
- [ ] 连接 Git 仓库
- [ ] 自动部署

---

## 📊 部署后验证

### 功能验证

- [ ] 前端页面正常访问
- [ ] 后端 API 正常响应
- [ ] 「记一笔」功能正常（弹框显示正确）
- [ ] 数据持久化（刷新页面后数据保留）
- [ ] 价格更新功能正常
- [ ] AI 识别功能正常（需用户配置 API Key）

### 性能验证

- [ ] 页面加载时间 < 3秒
- [ ] API 响应时间 < 2秒
- [ ] 缓存机制生效
- [ ] 无明显性能问题

### 安全验证

- [ ] HTTPS 访问（生产环境）
- [ ] API Keys 未暴露在前端代码
- [ ] 环境变量正确配置
- [ ] 无敏感信息泄露

---

## 🔄 回滚计划

如果部署后发现问题：

1. **前端回滚**
   - Vercel: Dashboard → Deployments → 选择之前版本 → Promote
   - Netlify: Deploys → 选择之前版本 → Publish deploy

2. **后端回滚**
   - Git: `git revert <commit-hash>`
   - 或：`git reset --hard <previous-commit>`
   - 重新部署

3. **数据恢复**
   - 前端数据在用户浏览器 localStorage
   - 后端缓存会自动重建

---

## 📝 部署后任务

- [ ] 更新文档中的生产环境 URL
- [ ] 通知用户新功能（弹框记录）
- [ ] 监控错误日志
- [ ] 收集用户反馈
- [ ] 记录部署版本和时间

---

## 🆘 常见问题

### Q: 弹框不显示？

A: 检查：
- 浏览器控制台是否有错误
- Element Plus 是否正确加载
- `showAddRecordDialog` 变量是否正确初始化

### Q: 后端 API 调用失败？

A: 检查：
- 后端服务是否运行（`http://localhost:3001/api/health`）
- CORS 配置是否正确
- 环境变量是否配置

### Q: 价格获取失败？

A: 检查：
- API Keys 是否配置正确
- 网络连接是否正常
- 查看后端日志了解具体错误

---

## ✅ 完成确认

全部检查完成后，在此签名确认：

- **检查人**: _________________
- **日期**: _________________
- **版本**: 2.1.0
- **备注**: _________________

---

**参考文档:**
- [SECURITY.md](SECURITY.md) - 安全配置详解
- [README.md](README.md) - 项目说明
- [CHANGELOG.md](CHANGELOG.md) - 版本更新记录
