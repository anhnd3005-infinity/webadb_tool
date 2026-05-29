#!/bin/bash
PORT=3456
PKG="com.app.live.tv.score.pro"

echo "============================================="
echo "📱 ADB Web Controller - Khởi động Local Server"
echo "============================================="

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js chưa được cài đặt! Vui lòng tải và cài đặt tại https://nodejs.org/"
    read -p "Nhấn Enter để thoát..."
    exit 1
fi

# Check adb
if ! command -v adb &> /dev/null; then
    echo "⚠️ Không tìm thấy lệnh 'adb' trong PATH máy tính."
    echo "Đảm bảo bạn đã cài đặt Android SDK và thêm adb vào PATH."
fi

# Download server.js if not present
if [ ! -f "server.js" ]; then
    echo "📥 Đang tải file server.js..."
    curl -sSL -o server.js https://webadb-tool.vercel.app/server.js
fi

# Run Server
echo "🚀 Đang khởi chạy Node.js server cho package: $PKG..."
node server.js $PKG
read -p "Nhấn Enter để thoát..."
