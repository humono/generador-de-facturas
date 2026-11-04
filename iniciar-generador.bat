@echo off
title Generador de Facturas
cd /d "%~dp0"

:: 1. Intento directo con el ejecutable nativo de Electron instalado
if exist "%~dp0node_modules\electron\dist\electron.exe" (
    start "" "%~dp0node_modules\electron\dist\electron.exe" "%~dp0."
    exit /b 0
)

:: 2. Alternativa con Node
where node >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    if exist "%~dp0node_modules\electron\cli.js" (
        start "" node "%~dp0node_modules\electron\cli.js" "%~dp0."
        exit /b 0
    )
)

:: 3. Alternativa con npm start
where npm >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    call npm start
    exit /b 0
)

:: Si no se pudo iniciar
echo ========================================================
echo  Error al iniciar el Generador de Facturas
echo ========================================================
echo No se ha podido iniciar la aplicacion.
echo Comprueba que Node.js esta instalado y accesible en tu sistema.
echo.
pause
