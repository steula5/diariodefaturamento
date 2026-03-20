$projectPath = "c:\Users\sup.vendas\Desktop\Arquivos desktop Filipe\diariodefaturamento-main\diariodefaturamento-main"
$batFile = Join-Path $projectPath "Iniciar Aplicação.bat"
$shortcutPath = Join-Path ([Environment]::GetFolderPath("Desktop")) "Diário de Faturamento.lnk"

# Criar objeto Shell.Application
$shell = New-Object -ComObject WScript.Shell

# Criar o atalho
$shortcut = $shell.CreateShortcut($shortcutPath)
$shortcut.TargetPath = "cmd.exe"
$shortcut.Arguments = "/c `"$batFile`""
$shortcut.WorkingDirectory = $projectPath
$shortcut.WindowStyle = 1  # Normal window
$shortcut.Save()

Write-Host "Atalho criado com sucesso em: $shortcutPath"
