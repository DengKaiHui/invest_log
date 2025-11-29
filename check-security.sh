#!/bin/bash

# 部署前安全检查脚本

echo "🔒 InvestLog 安全检查"
echo "===================="
echo ""

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 检查计数
PASS=0
WARN=0
FAIL=0

# 1. 检查 .env 文件是否在 .gitignore 中
echo "📋 检查 1: .gitignore 配置"
if grep -q "^\.env" .gitignore; then
    echo -e "${GREEN}✓${NC} .env 已在 .gitignore 中"
    PASS=$((PASS+1))
else
    echo -e "${RED}✗${NC} .env 未在 .gitignore 中！"
    FAIL=$((FAIL+1))
fi

# 2. 检查 .env 文件是否存在且未被跟踪
echo ""
echo "📋 检查 2: .env 文件状态"
if [ -f .env ]; then
    if git ls-files --error-unmatch .env 2>/dev/null; then
        echo -e "${RED}✗${NC} .env 文件已被 Git 跟踪！请立即移除："
        echo "   git rm --cached .env"
        FAIL=$((FAIL+1))
    else
        echo -e "${GREEN}✓${NC} .env 文件存在但未被跟踪"
        PASS=$((PASS+1))
    fi
else
    echo -e "${YELLOW}⚠${NC} .env 文件不存在（开发环境需要）"
    WARN=$((WARN+1))
fi

# 3. 检查代码中是否有硬编码的 API Key（常见模式）
echo ""
echo "📋 检查 3: 硬编码 API Key 检测"
HARDCODED=0

# 检查 OpenAI Keys
if grep -r "sk-[a-zA-Z0-9]\{32,\}" --include="*.js" --include="*.html" . 2>/dev/null | grep -v node_modules | grep -v ".git"; then
    echo -e "${RED}✗${NC} 发现可能的 OpenAI API Key！"
    HARDCODED=1
fi

# 检查 Google Keys
if grep -r "AIza[a-zA-Z0-9_-]\{35\}" --include="*.js" --include="*.html" . 2>/dev/null | grep -v node_modules | grep -v ".git"; then
    echo -e "${RED}✗${NC} 发现可能的 Google API Key！"
    HARDCODED=1
fi

# 检查其他常见 Key 模式
if grep -rE "(api_key|apikey|API_KEY|APIKEY)\s*=\s*['\"][a-zA-Z0-9]{20,}['\"]" --include="*.js" . 2>/dev/null | grep -v node_modules | grep -v ".git" | grep -v "process.env"; then
    echo -e "${YELLOW}⚠${NC} 发现可疑的 API Key 赋值"
    HARDCODED=1
fi

if [ $HARDCODED -eq 0 ]; then
    echo -e "${GREEN}✓${NC} 未发现硬编码的 API Key"
    PASS=$((PASS+1))
else
    FAIL=$((FAIL+1))
fi

# 4. 检查 Git 历史中是否有 .env
echo ""
echo "📋 检查 4: Git 历史中的 .env"
if git log --all --full-history --source -- .env 2>/dev/null | grep -q "."; then
    echo -e "${RED}✗${NC} .env 文件曾被提交到 Git 历史！"
    echo "   需要清理 Git 历史"
    FAIL=$((FAIL+1))
else
    echo -e "${GREEN}✓${NC} .env 未在 Git 历史中"
    PASS=$((PASS+1))
fi

# 5. 检查 package.json 中的脚本
echo ""
echo "📋 检查 5: package.json 脚本配置"
if [ -f package.json ]; then
    if grep -q "\"start\":" package.json && grep -q "\"test\":" package.json; then
        echo -e "${GREEN}✓${NC} package.json 脚本配置正常"
        PASS=$((PASS+1))
    else
        echo -e "${YELLOW}⚠${NC} package.json 缺少必要脚本"
        WARN=$((WARN+1))
    fi
else
    echo -e "${YELLOW}⚠${NC} package.json 不存在"
    WARN=$((WARN+1))
fi

# 6. 检查 README 是否提到安全文档
echo ""
echo "📋 检查 6: 文档完整性"
if grep -q "SECURITY.md" README.md 2>/dev/null; then
    echo -e "${GREEN}✓${NC} README 包含安全文档链接"
    PASS=$((PASS+1))
else
    echo -e "${YELLOW}⚠${NC} README 未提及安全文档"
    WARN=$((WARN+1))
fi

# 7. 检查是否有未提交的更改
echo ""
echo "📋 检查 7: Git 状态"
if git diff --quiet && git diff --cached --quiet; then
    echo -e "${GREEN}✓${NC} 无未提交的更改"
    PASS=$((PASS+1))
else
    echo -e "${YELLOW}⚠${NC} 有未提交的更改"
    git status --short
    WARN=$((WARN+1))
fi

# 8. 检查 server.js 是否使用环境变量
echo ""
echo "📋 检查 8: 后端环境变量配置"
if grep -q "process.env.FINNHUB_KEY" server.js 2>/dev/null; then
    echo -e "${GREEN}✓${NC} server.js 使用环境变量"
    PASS=$((PASS+1))
else
    echo -e "${YELLOW}⚠${NC} server.js 可能未正确配置环境变量"
    WARN=$((WARN+1))
fi

# 总结
echo ""
echo "===================="
echo "📊 检查结果汇总"
echo "===================="
echo -e "${GREEN}通过:${NC} $PASS"
echo -e "${YELLOW}警告:${NC} $WARN"
echo -e "${RED}失败:${NC} $FAIL"
echo ""

if [ $FAIL -gt 0 ]; then
    echo -e "${RED}❌ 安全检查失败！请修复上述问题后再部署${NC}"
    exit 1
elif [ $WARN -gt 0 ]; then
    echo -e "${YELLOW}⚠️  有警告项，建议检查后再部署${NC}"
    exit 0
else
    echo -e "${GREEN}✅ 所有检查通过，可以安全部署${NC}"
    exit 0
fi
