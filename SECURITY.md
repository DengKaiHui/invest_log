# 🔒 安全配置指南

本文档说明如何安全地部署和使用 InvestLog 投资看板。

---

## 📋 安全检查清单

### ✅ 已实施的安全措施

- [x] **环境变量管理**: 后端 API Keys 通过环境变量配置
- [x] **.gitignore**: 已配置忽略 `.env` 文件
- [x] **前端密钥**: AI API Key 存储在浏览器 localStorage（用户自行配置）
- [x] **代码中无硬编码密钥**: 所有代码已检查，无硬编码的 API Key
- [x] **密码输入保护**: 前端配置表单使用 `type="password"` 和 `show-password`

### ⚠️ 部署前必须检查

- [ ] 确认 `.env` 文件不在版本控制中
- [ ] 确认没有将真实 API Key 提交到代码仓库
- [ ] 配置服务器环境变量（生产环境）
- [ ] 检查 `git status` 和 `git log`，确保没有敏感信息

---

## 🌐 部署到线上

### 方案 1: 静态托管 + 本地后端（推荐个人使用）

**前端部署到静态托管服务:**
- Vercel / Netlify / GitHub Pages
- 只需部署静态文件 (HTML, CSS, JS)
- 无需配置 API Keys

**后端在本地运行:**
```bash
# 配置环境变量
export FINNHUB_KEY="your_key"
export ALPHA_VANTAGE_KEY="your_key"

# 启动后端
npm start
```

**优点:**
- ✅ API Keys 完全在本地，不会泄露
- ✅ 前端静态文件可公开访问
- ✅ 配置简单

**缺点:**
- ⚠️ 需要本地运行后端服务
- ⚠️ 手机等外部设备无法访问

---

### 方案 2: 全栈部署到云服务

适合部署到 Vercel、Netlify、Railway、Render 等云平台。

#### 环境变量配置

在云平台控制台配置以下环境变量：

```bash
# 必填（后端 API Keys）
FINNHUB_KEY=your_finnhub_api_key
ALPHA_VANTAGE_KEY=your_alphavantage_api_key

# 可选（如需自定义）
PORT=3001
```

#### Vercel 部署示例

1. **创建 `vercel.json`：**

```json
{
  "version": 2,
  "builds": [
    {
      "src": "server.js",
      "use": "@vercel/node"
    },
    {
      "src": "index.html",
      "use": "@vercel/static"
    }
  ],
  "routes": [
    {
      "src": "/api/(.*)",
      "dest": "server.js"
    },
    {
      "src": "/(.*)",
      "dest": "$1"
    }
  ],
  "env": {
    "FINNHUB_KEY": "@finnhub-key",
    "ALPHA_VANTAGE_KEY": "@alphavantage-key"
  }
}
```

2. **在 Vercel 控制台添加环境变量：**
   - 项目设置 → Environment Variables
   - 添加 `FINNHUB_KEY` 和 `ALPHA_VANTAGE_KEY`

3. **部署：**
```bash
vercel deploy
```

#### Render 部署示例

1. **创建 `render.yaml`：**

```yaml
services:
  - type: web
    name: invest-log
    env: node
    buildCommand: npm install
    startCommand: npm start
    envVars:
      - key: FINNHUB_KEY
        sync: false
      - key: ALPHA_VANTAGE_KEY
        sync: false
```

2. **在 Render 控制台配置环境变量**

---

## 🔐 API Key 管理最佳实践

### 后端 API Keys (Finnhub, Alpha Vantage)

**❌ 错误做法：**
```javascript
// 不要在代码中硬编码
const FINNHUB_KEY = "abc123xyz456";
```

**✅ 正确做法：**
```javascript
// 使用环境变量
const FINNHUB_KEY = process.env.FINNHUB_KEY || 'demo';
```

**本地开发：**
```bash
# 方法1: 临时设置
export FINNHUB_KEY="your_key"

# 方法2: .env 文件（推荐）
echo 'FINNHUB_KEY=your_key' > .env
npm install dotenv
# 在 server.js 顶部添加: import 'dotenv/config';
```

### 前端 AI API Keys (Gemini, OpenAI)

**存储位置:**
- ✅ localStorage（用户浏览器本地）
- ✅ 用户在设置界面手动配置
- ❌ 不要硬编码在前端代码中

**特点:**
- 每个用户使用自己的 API Key
- 数据不会上传到服务器
- 更换浏览器需要重新配置

---

## 🚨 紧急响应：如果 API Key 泄露

### 立即采取的行动

1. **吊销泄露的 API Key**
   - Finnhub: Dashboard → API Keys → Revoke
   - Alpha Vantage: 重新生成新的 Key
   - OpenAI/Gemini: 在控制台禁用旧 Key

2. **生成新的 API Key**

3. **更新环境变量**
   ```bash
   # 本地
   export FINNHUB_KEY="new_key"
   
   # 云平台
   # 在控制台更新环境变量并重新部署
   ```

4. **检查代码仓库历史**
   ```bash
   # 搜索是否有 API Key 被提交
   git log -p | grep -i "api.*key"
   
   # 如果发现泄露，使用 git filter-branch 或 BFG Repo-Cleaner 清理历史
   ```

5. **重新部署服务**

---

## 📁 文件权限和敏感文件

### 不应提交到 Git 的文件

已在 `.gitignore` 中配置：

```gitignore
# 环境变量文件
.env
.env.local
.env.*.local

# 用户配置导出
config.json
local-config.json

# 临时文件
*.tmp
*.temp
.cache/

# 依赖和日志
node_modules/
*.log
```

### 检查命令

```bash
# 查看即将提交的文件
git status

# 确保 .env 不在列表中
git ls-files | grep .env

# 如果意外添加，立即移除
git rm --cached .env
```

---

## 🔍 安全审计

### 定期检查

```bash
# 1. 检查是否有硬编码的密钥
grep -r "sk-[a-zA-Z0-9]" .
grep -r "AIza" .
grep -r "FINNHUB_KEY.*=" . --include="*.js"

# 2. 检查 .gitignore 是否生效
git status --ignored

# 3. 检查最近的提交
git log --all --full-history --source -- .env

# 4. 扫描敏感信息（使用工具）
# npm install -g git-secrets
git secrets --scan
```

---

## ✅ 部署前检查表

- [ ] `.env` 文件已添加到 `.gitignore`
- [ ] 代码中无硬编码的 API Keys
- [ ] 环境变量已在云平台配置
- [ ] 前端 AI 配置提示用户自行填写
- [ ] 测试本地和生产环境都能正常运行
- [ ] 文档中无真实的 API Keys 示例
- [ ] `git log` 历史中无敏感信息
- [ ] README 中说明了如何配置 API Keys

---

## 📚 相关文档

- [API_KEY_SETUP.md](API_KEY_SETUP.md) - API Key 获取和配置
- [README.md](README.md) - 项目说明和使用指南
- [.env.example](.env.example) - 环境变量配置模板

---

## 🆘 获取帮助

如果发现安全问题，请：

1. 不要在 GitHub Issues 中公开讨论
2. 直接联系项目维护者
3. 或发送邮件到项目邮箱

---

**最后更新**: 2025-11-29
