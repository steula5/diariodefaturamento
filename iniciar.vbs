Set objShell = CreateObject("WScript.Shell")
strProjectPath = "c:\Users\sup.vendas\Desktop\Arquivos desktop Filipe\diariodefaturamento-main\diariodefaturamento-main"

' Define o PATH para incluir Node.js
Set objEnv = objShell.Environment("PROCESS")
objEnv("PATH") = objEnv("PATH") & ";C:\Program Files\nodejs"

' Executa npm run dev em background sem mostrar janela
objShell.Run "cmd /c cd /d """ & strProjectPath & """ && npm run dev", 0, False

' Aguarda alguns segundos para o servidor iniciar
WScript.Sleep 3000

' Abre o navegador
objShell.Run "start http://localhost:8080", 0, False

Set objShell = Nothing
