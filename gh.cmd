@echo off
setlocal
set "PATH=%~dp0.tools\gh\bin;%~dp0.tools\mingit\cmd;%~dp0.tools\mingit\mingw64\bin;%~dp0.tools\node;%PATH%"
"%~dp0.tools\gh\bin\gh.exe" %*
