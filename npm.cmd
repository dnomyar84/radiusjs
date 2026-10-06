@echo off
setlocal
set "PATH=%~dp0.tools\node;%~dp0.tools\mingit\cmd;%~dp0.tools\gh\bin;%PATH%"
"%~dp0.tools\node\npm.cmd" %*
