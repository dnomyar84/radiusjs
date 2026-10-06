@echo off
setlocal
set "PATH=%~dp0.tools\node;%~dp0.tools\mingit\cmd;%PATH%"
"%~dp0.tools\node\node.exe" %*
