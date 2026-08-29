' ============================================================================
' Vaniki Crop Science - Silent Background Launcher for Windows 10
' Runs the Tally Sync Agent in background with NO visible terminal window.
' ============================================================================

Set WshShell = CreateObject("WScript.Shell")
Set FSO = CreateObject("Scripting.FileSystemObject")
ScriptDir = FSO.GetParentFolderName(WScript.ScriptFullName)

WshShell.CurrentDirectory = ScriptDir
WshShell.Run "cmd /c node """ & ScriptDir & "\vaniki-tally-sync.js"" >> """ & ScriptDir & "\tally-agent.log"" 2>&1", 0, False
