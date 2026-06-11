#!/bin/bash
# Запуск TRIUMPH Outreach Bot
cd "$(dirname "$0")"

if [ ! -f .env ]; then
  echo "❌ Файл .env не найден!"
  echo "Скопируй .env.example → .env и заполни:"
  echo "  cp .env.example .env"
  echo "  nano .env"
  exit 1
fi

# Check Node version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
  echo "⚠️  Нужен Node.js 18+. У тебя $(node -v)"
fi

echo "🥊 Запускаю TRIUMPH Outreach Bot..."
echo ""
node index.js
