@echo off
setlocal

:: ── Load free API keys if file exists ────────────────────────────────────────
set KEYS_FILE=%~dp0free-keys.env
if exist "%KEYS_FILE%" (
    for /f "usebackq tokens=1,2 delims==" %%a in ("%KEYS_FILE%") do (
        if not "%%a"=="" if not "%%b"=="" (
            echo %%a | findstr /b "#" >nul || set %%a=%%b
        )
    )
)

:: ── Pick best available backend ───────────────────────────────────────────────
set MODE=local
set LITELLM_MODEL=ollama/qwen3.5:9b

if defined GROQ_API_KEY (
    echo %%GROQ_API_KEY%% | findstr /c:"your_key_here" >nul || (
        set MODE=groq
        set LITELLM_MODEL=groq/llama-3.3-70b-versatile
    )
)

if "%MODE%"=="local" if defined GOOGLE_API_KEY (
    echo %%GOOGLE_API_KEY%% | findstr /c:"your_key_here" >nul || (
        set MODE=gemini
        set LITELLM_MODEL=gemini/gemini-2.0-flash
    )
)

if "%MODE%"=="local" if defined CEREBRAS_API_KEY (
    echo %%CEREBRAS_API_KEY%% | findstr /c:"your_key_here" >nul || (
        set MODE=cerebras
        set LITELLM_MODEL=cerebras/llama-3.3-70b
    )
)

echo Switching to FREE mode [%MODE% / %LITELLM_MODEL%]...
copy /Y "%USERPROFILE%\.claude\settings.free.json" "%USERPROFILE%\.claude\settings.json" >nul

:: ── If local, ensure Ollama is on PATH ───────────────────────────────────────
if "%MODE%"=="local" (
    SET PATH=%PATH%;%LOCALAPPDATA%\Programs\Ollama
    echo NOTE: Using local Ollama. GPU acceleration requires AMD HIP SDK.
    echo       See: https://www.amd.com/en/developer/resources/rocm-hub/hip-sdk.html
)

:: ── Start LiteLLM proxy if not already running ────────────────────────────────
curl -s http://localhost:4000/health >nul 2>&1
if %errorlevel% neq 0 (
    echo Starting LiteLLM proxy on port 4000...
    if "%MODE%"=="groq" (
        start /min cmd /c "set PYTHONIOENCODING=utf-8 && set GROQ_API_KEY=%GROQ_API_KEY% && litellm --model %LITELLM_MODEL% --port 4000"
    ) else if "%MODE%"=="gemini" (
        start /min cmd /c "set PYTHONIOENCODING=utf-8 && set GOOGLE_API_KEY=%GOOGLE_API_KEY% && litellm --model %LITELLM_MODEL% --port 4000"
    ) else if "%MODE%"=="cerebras" (
        start /min cmd /c "set PYTHONIOENCODING=utf-8 && set CEREBRAS_API_KEY=%CEREBRAS_API_KEY% && litellm --model %LITELLM_MODEL% --port 4000"
    ) else (
        start /min cmd /c "set PYTHONIOENCODING=utf-8 && litellm --model %LITELLM_MODEL% --port 4000"
    )
    echo Waiting for proxy to start...
    timeout /t 7 /nobreak >nul
) else (
    echo LiteLLM proxy already running.
)

echo Launching Claude...
claude --dangerously-skip-permissions
endlocal
