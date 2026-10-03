@echo off
echo Updating 4.SecondServe_Project_Specification.docx...
copy /Y "4.SecondServe_Project_Specification_Updated.docx" "4.SecondServe_Project_Specification.docx"
if %ERRORLEVEL% EQU 0 (
  echo [SUCCESS] 4.SecondServe_Project_Specification.docx updated successfully!
) else (
  echo [NOTE] Please close Microsoft Word first, then run this file again.
)
pause
