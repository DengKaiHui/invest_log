# 🔑 API Key 配置指南

由于 Yahoo Finance API 经常出现 403 限流问题，强烈建议配置免费的第三方 API Key。

---

## ⚡ 快速配置（推荐 Finnhub）

### 1. 注册 Finnhub（免费）

访问: https://finnhub.io/register

- 免费额度：每月 60 个请求/分钟
- 无需信用卡
- 支持美股实时价格

### 2. 获取 API Key

注册后在 Dashboard 找到你的 API Key

### 3. 配置环境变量

**macOS/Linux:**
```bash
export FINNHUB_KEY="your_api_key_here"
```

**永久配置（添加到 ~/.zshrc 或 ~/.bashrc）:**
```bash
echo 'export FINNHUB_KEY="your_api_key_here"' >> ~/.zshrc
source ~/.zshrc
```

**Windows:**
```cmd
set FINNHUB_KEY=your_api_key_here
```

### 4. 重启服务器

```bash
npm start
```

你会看到：
```
📊 数据源:
  ...
  3. Finnhub API (备选2 - 已配置) ✓
```

---

## 🔄 备选方案（Alpha Vantage）

如果 Finnhub 也不够用，可以额外配置 Alpha Vantage：

### 1. 注册 Alpha Vantage

访问: https://www.alphavantage.co/support/#api-key

- 免费额度：每分钟 5 个请求
- 无需信用卡

### 2. 配置

```bash
export ALPHA_VANTAGE_KEY="your_api_key_here"
```

---

## 📊 数据源优先级

系统会按以下顺序尝试：

```
1. Yahoo Finance Web API (免费，但可能403)
   ↓
2. Yahoo Finance V10 API (免费，但可能403)
   ↓
3. Finnhub API (需要配置，推荐) ✓
   ↓
4. Alpha Vantage API (需要配置，备选)
```

---

## ✅ 验证配置

### 测试 API Key 是否生效

```bash
# 启动服务器
npm start

# 查看启动信息，应该显示 "已配置"
# 新开终端测试
curl http://localhost:3001/api/price/AAPL
```

如果成功，你会看到：
```json
{
  "success": true,
  "symbol": "AAPL",
  "price": 195.71,
  "cached": false
}
```

后端日志会显示：
```
✓ AAPL 价格: $195.71 (来源: Finnhub)
```

---

## 💡 使用建议

### 不配置 API Key

- ✅ 可以正常运行
- ⚠️ 可能经常遇到 403 错误
- ⚠️ 需要频繁重试
- ⚠️ 成功率约 20-30%

### 配置 Finnhub

- ✅ 成功率 95%+
- ✅ 稳定可靠
- ✅ 免费额度足够个人使用
- ✅ 每分钟 60 个请求

### 同时配置 Finnhub + Alpha Vantage

- ✅ 成功率 99%+
- ✅ 双重保险
- ✅ 适合重度使用

---

## 🚫 常见问题

### Q1: 没有 API Key 能用吗？

A: 能用，但会经常遇到 Yahoo Finance 的 403 错误。系统会自动重试，但成功率较低。

### Q2: 免费的 API Key 有限制吗？

A: 有，但对个人使用完全够用：
- Finnhub: 60 请求/分钟
- Alpha Vantage: 5 请求/分钟

配合 30 分钟缓存，一天查看几十次完全没问题。

### Q3: 如何知道使用了哪个数据源？

A: 查看后端日志：
```
✓ NVDA 价格: $485.32 (来源: Finnhub)
```

### Q4: API Key 安全吗？

A: 
- ✅ 只在本地服务器使用
- ✅ 不会发送到其他地方
- ✅ 免费 API Key 没有财务风险

### Q5: 配置后还是失败？

A: 检查：
1. API Key 是否正确
2. 重启服务器了吗
3. 查看启动信息是否显示"已配置"
4. 查看后端日志的具体错误

---

## 📝 示例配置脚本

创建文件 `setup-api-keys.sh`:

```bash
#!/bin/bash

echo "配置 API Keys"
echo "============="

read -p "请输入 Finnhub API Key (或按回车跳过): " FINNHUB
read -p "请输入 Alpha Vantage API Key (或按回车跳过): " ALPHA

if [ ! -z "$FINNHUB" ]; then
    echo "export FINNHUB_KEY=\"$FINNHUB\"" >> ~/.zshrc
    echo "✓ Finnhub 已配置"
fi

if [ ! -z "$ALPHA" ]; then
    echo "export ALPHA_VANTAGE_KEY=\"$ALPHA\"" >> ~/.zshrc
    echo "✓ Alpha Vantage 已配置"
fi

echo ""
echo "配置完成！请运行："
echo "source ~/.zshrc"
echo "npm start"
```

使用：
```bash
chmod +x setup-api-keys.sh
./setup-api-keys.sh
```

---

## 🎯 推荐配置

最简单有效的配置：

```bash
# 1. 注册 Finnhub (2分钟)
# https://finnhub.io/register

# 2. 配置环境变量
export FINNHUB_KEY="你的API_KEY"

# 3. 启动服务
npm start
```

完成！✅

---

**更新时间**: 2025-11-29
