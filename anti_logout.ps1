$wshell = New-Object -ComObject WScript.Shell
while ($true) {
    Start-Sleep -Seconds 240
    $wshell.SendKeys("{SCROLLLOCK}")
    Start-Sleep -Seconds 1
    $wshell.SendKeys("{SCROLLLOCK}")
}