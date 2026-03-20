@echo off
setlocal enabledelayedexpansion

:: Adiciona Node.js ao PATH
set "PATH=%PATH%;C:\Program Files\nodejs"

:: Muda para o diretório do projeto
cd /d "%~dp0"

:: Verifica se node está disponível
node -v >nul 2>&1
if errorlevel 1 (
    echo Erro: Node.js não foi encontrado. Por favor, instale Node.js em C:\Program Files\nodejs
    pause
    exit /b 1
)

:: Inicia o servidor em background
echo Iniciando o Diário de Faturamento...
start "" npm run dev

:: Aguarda alguns segundos para o servidor iniciar
timeout /t 3 /nobreak

:: Abre o navegador
start http://localhost:8080

echo.
echo Aplicação aberta em http://localhost:8080
echo Pressione Ctrl+C no prompt de comando para parar o servidor
pause
