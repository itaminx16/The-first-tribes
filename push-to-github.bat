@echo off
chcp 65001 >nul
echo ===================================================
echo   Первісні Племена — Автоматичне вивантаження на GitHub
echo ===================================================

where git >nul 2>nul
if %errorlevel% neq 0 (
    if exist "C:\Program Files\Git\cmd\git.exe" (
        set "PATH=%PATH%;C:\Program Files\Git\cmd"
    ) else (
        echo [!] Git не знайдено! Спочатку встановіть Git з https://git-scm.com/download/win
        pause
        exit /b 1
    )
)

if not exist ".git" (
    echo [*] Ініціалізація репозиторію...
    git init
    git branch -M main
    git remote add origin https://github.com/itaminx16/The-first-tribes.git
)

echo [*] Додавання змінених файлів...
git add -A

set "COMMIT_MSG=Update game: %date% %time%"
git commit -m "%COMMIT_MSG%"

echo [*] Відправка на GitHub (https://github.com/itaminx16/The-first-tribes)...
git push -u origin main

echo.
echo [✓] Готово! Оновлення відправлено на GitHub.
pause
