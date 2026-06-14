$content = Get-Content 'c:\Users\User\Filmdba\lumi\public\e34f3b90-9329-4ab7-8cb3-a9e11fc7a9da.htm' -Raw
Write-Output "--- LINKS ---"
$linkRegex = '<a\s+[^>]*href=["'']?([^>"''\s]+)["'']?[^>]*>(.*?)</a>'
[regex]::Matches($content, $linkRegex, 'IgnoreCase') | ForEach-Object {
    $href = $_.Groups[1].Value
    $text = $_.Groups[2].Value -replace '<[^>]+>','' -replace '\s+',' '
    if ($href -match 'genre|people|person') {
        Write-Output "$href : $text"
    }
} | Select-Object -First 30

Write-Output "--- META DESC ---"
$metaRegex = '<meta\s+[^>]*name=["'']?description["'']?[^>]*content=["'']?([^"''\s>]+(?:[\s]+[^"''\s>]+)*)["'']?[^>]*>'
[regex]::Matches($content, $metaRegex, 'IgnoreCase') | ForEach-Object {
    Write-Output "Desc: $($_.Groups[1].Value)"
}
