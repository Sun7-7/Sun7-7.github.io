# Create a new blog post JSON file for Windows PowerShell.
# Usage: .\new-post.ps1 -Title "文章标题" [-Category "研究笔记"]

param(
    [Parameter(Mandatory = $true)]
    [string]$Title,
    [string]$Category = "研究笔记"
)

$ErrorActionPreference = "Stop"
$PostsDir = Join-Path $PSScriptRoot "posts"
if (-not (Test-Path $PostsDir)) {
    New-Item -ItemType Directory -Path $PostsDir | Out-Null
}

function Get-SlugFromTitle {
    param([string]$Text)

    $lower = $Text.ToLowerInvariant()
    $slug = [regex]::Replace($lower, '[^a-z0-9\p{IsCJKUnifiedIdeographs}]', '-')
    $slug = [regex]::Replace($slug, '-+', '-').Trim('-')
    if ($slug.Length -gt 60) {
        $slug = $slug.Substring(0, 60).TrimEnd('-')
    }
    if ([string]::IsNullOrWhiteSpace($slug) -or $slug -notmatch '[a-z]') {
        $slug = 'post-' + (Get-Date -Format 'yyyyMMdd')
    }
    return $slug
}

$Slug = Get-SlugFromTitle -Text $Title
$Date = Get-Date -Format 'yyyy-MM-dd'
$FilePath = Join-Path $PostsDir "$Slug.json"

if (Test-Path $FilePath) {
    $Slug = "$Slug-$(Get-Date -Format 'HHmmss')"
    $FilePath = Join-Path $PostsDir "$Slug.json"
}

$post = [ordered]@{
    slug = $Slug
    title = $Title
    date = $Date
    category = $Category
    excerpt = "在这里写文章摘要。"
    content = "<h2>引言</h2>`n<p>在这里开始写正文。</p>`n"
}

$json = $post | ConvertTo-Json -Depth 5
[System.IO.File]::WriteAllText($FilePath, $json, [System.Text.UTF8Encoding]::new($false))

Write-Host "New post created: $FilePath" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:"
Write-Host "  1. Edit the generated JSON file."
Write-Host "  2. Update excerpt and content."
Write-Host "  3. Add the post metadata to posts/index.json."
Write-Host "  4. Run .\serve.ps1 to preview."
