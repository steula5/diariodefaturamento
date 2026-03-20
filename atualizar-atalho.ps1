$projectPath = "c:\Users\sup.vendas\Desktop\Arquivos desktop Filipe\diariodefaturamento-main\diariodefaturamento-main"
$vbsFile = Join-Path $projectPath "iniciar.vbs"
$shortcutPath = Join-Path ([Environment]::GetFolderPath("Desktop")) "Diário de Faturamento.lnk"

# Criar objeto Shell.Application
$shell = New-Object -ComObject WScript.Shell

# Criar o atalho
$shortcut = $shell.CreateShortcut($shortcutPath)
$shortcut.TargetPath = "wscript.exe"
$shortcut.Arguments = "`"$vbsFile`""
$shortcut.WorkingDirectory = $projectPath
$shortcut.WindowStyle = 0  # Hidden
$shortcut.Save()

Write-Host "Atalho atualizado com sucesso!"
