#!/usr/bin/env bash
# Подготовка окружения проекта.
#
# Папки node_modules и tools/venv не сохраняются между сессиями, поэтому
# скрипт доводит окружение до рабочего состояния и его безопасно запускать
# повторно: он проверяет, что уже есть, и доустанавливает только недостающее.
#
# Использование:
#   tools/setup.sh          # поставить всё, что нужно для разработки
#   tools/setup.sh --check  # только проверить и сказать, чего не хватает
set -euo pipefail

cd "$(dirname "$0")/.."
CHECK_ONLY=0
[ "${1:-}" = "--check" ] && CHECK_ONLY=1

missing=0

# --- Питон-инструменты (вырезание спрайтов, симулятор баланса) ---
if [ -x tools/venv/bin/python ]; then
  echo "ок: окружение питон-инструментов (tools/venv)"
else
  missing=$((missing + 1))
  echo "нет: окружение питон-инструментов"
  if [ "$CHECK_ONLY" = "0" ]; then
    python3 -m venv tools/venv
    tools/venv/bin/pip install --quiet --upgrade pip
    tools/venv/bin/pip install --quiet -r tools/requirements.txt
    echo "поставлено: tools/venv"
  fi
fi

# --- Пакеты Node (игра, тесты, сборка) ---
if [ -d node_modules ] && [ -f node_modules/.bin/vite ] && [ -f node_modules/.bin/vitest ]; then
  echo "ок: пакеты Node (node_modules)"
else
  missing=$((missing + 1))
  echo "нет: пакеты Node"
  if [ "$CHECK_ONLY" = "0" ]; then
    npm install --no-fund --no-audit --silent
    echo "поставлено: node_modules"
  fi
fi

if [ "$CHECK_ONLY" = "1" ]; then
  if [ "$missing" -gt 0 ]; then
    echo "не хватает компонентов: $missing — запусти tools/setup.sh"
    exit 1
  fi
  echo "окружение готово"
fi
