# LinkSlinger Repository Cleanup Script
# Removes internal files from git tracking (keeps them locally)

Write-Host "🧹 Cleaning up repository for public release..." -ForegroundColor Cyan
Write-Host ""

# Files to remove from git tracking
$filesToRemove = @(
    "CI_CD_VERIFICATION.md",
    "CONFLICTS_RESOLVED.md",
    "build.xml"
)

# Directories to remove from git tracking
$dirsToRemove = @(
    "jtd"
    # "media"  # Uncomment if media/ should be removed
)

Write-Host "Removing files from git tracking..." -ForegroundColor Yellow
foreach ($file in $filesToRemove) {
    if (Test-Path $file) {
        git rm --cached $file 2>$null
        if ($LASTEXITCODE -eq 0) {
            Write-Host "  ✓ Removed: $file" -ForegroundColor Green
        } else {
            Write-Host "  ⚠ Not tracked: $file" -ForegroundColor Yellow
        }
    } else {
        Write-Host "  ⚠ File not found: $file" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "Removing directories from git tracking..." -ForegroundColor Yellow
foreach ($dir in $dirsToRemove) {
    if (Test-Path $dir) {
        git rm -r --cached $dir 2>$null
        if ($LASTEXITCODE -eq 0) {
            Write-Host "  ✓ Removed: $dir/" -ForegroundColor Green
        } else {
            Write-Host "  ⚠ Not tracked: $dir/" -ForegroundColor Yellow
        }
    } else {
        Write-Host "  ⚠ Directory not found: $dir/" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "✅ Cleanup complete!" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "  1. Review changes: git status" -ForegroundColor Gray
Write-Host "  2. Commit: git commit -m 'Cleanup: Remove internal files from public repo'" -ForegroundColor Gray
Write-Host "  3. Push: git push origin main" -ForegroundColor Gray
Write-Host ""
