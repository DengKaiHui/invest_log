#!/bin/bash

# 投资看板启动脚本

echo "🚀 投资看板启动脚本"
echo "===================="

# 检查 Node.js 是否安装
if ! command -v node &> /dev/null
then
    echo "❌ Node.js 未安装，请先安装 Node.js"
    exit 1
fi

echo "✓ Node.js 版本: $(node -v)"

# 检查 npm 是否安装
if ! command -v npm &> /dev/null
then
    echo "❌ npm 未安装"
    exit 1
fi

echo "✓ npm 版本: $(npm -v)"

# 检查是否已安装依赖
if [ ! -d "node_modules" ]; then
    echo ""
    echo "📦 检测到未安装依赖，正在安装..."
    npm install
    if [ $? -ne 0 ]; then
        echo "❌ 依赖安装失败"
        exit 1
    fi
    echo "✓ 依赖安装完成"
fi

echo ""
echo "===================="
echo "🎯 启动选项："
echo "1. 启动后端服务 (推荐)"
echo "2. 测试后端服务"
echo "3. 查看帮助"
echo "===================="
read -p "请选择 (1-3): " choice

case $choice in
    1)
        echo ""
        echo "🚀 正在启动后端服务..."
        echo "📡 服务地址: http://localhost:3001"
        echo ""
        echo "💡 提示："
        echo "  - 请在另一个终端启动前端服务"
        echo "  - 前端命令: python3 -m http.server 8000"
        echo "  - 然后访问: http://localhost:8000/index.html"
        echo ""
        echo "按 Ctrl+C 停止服务"
        echo "===================="
        npm start
        ;;
    2)
        echo ""
        echo "🧪 正在测试后端服务..."
        echo "请确保后端服务已在另一个终端启动 (npm start)"
        echo ""
        read -p "按回车继续测试..."
        npm test
        ;;
    3)
        echo ""
        echo "📖 使用帮助"
        echo "===================="
        echo "完整文档请查看: START_SERVER.md"
        echo ""
        echo "快速开始："
        echo "1. npm install      # 安装依赖"
        echo "2. npm start        # 启动后端服务"
        echo "3. npm test         # 测试后端服务"
        echo ""
        echo "前端启动（新开终端）："
        echo "python3 -m http.server 8000"
        echo "然后访问: http://localhost:8000/index.html"
        ;;
    *)
        echo "❌ 无效选择"
        exit 1
        ;;
esac
