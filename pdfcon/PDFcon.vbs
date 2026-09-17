' Uruchamia PDFcon (npm start) bez pokazywania okna konsoli.
' Do tego pliku wystarczy zrobić skrót na pulpicie (patrz README.md).

Set fso = CreateObject("Scripting.FileSystemObject")
scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)

Set shell = CreateObject("WScript.Shell")
shell.CurrentDirectory = scriptDir
shell.Run "cmd /c npm start", 0, False
