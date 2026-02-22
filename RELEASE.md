# Release Process

This document outlines the release process for LinkSlinger extension.

## Automated Release Workflow

LinkSlinger uses GitHub Actions for automated builds and releases. The process is triggered by creating version tags.

## Creating a Release

### Step 1: Update Version

Update the version in `src/manifest.json`:

```json
{
  "version": "3.0.1",
  ...
}
```

### Step 2: Commit and Push

```bash
git add src/manifest.json
git commit -m "Release v3.0.1"
git push origin main
```

### Step 3: Create and Push Tag

```bash
# Create tag (must match version in manifest.json)
git tag v3.0.1

# Push tag to trigger release workflow
git push origin v3.0.1
```

### Step 4: Wait for Automation

The GitHub Actions workflow will automatically:
1. ✅ Verify version matches tag
2. ✅ Build extension package
3. ✅ Create GitHub Release
4. ✅ Upload `.zip` file as release asset
5. ✅ (Optional) Auto-publish to Chrome Web Store

### Step 5: Verify Release

1. Go to **Releases** section on GitHub
2. Verify new release appears with correct version
3. Download `.zip` file and test installation
4. Check Chrome Web Store (if auto-publish enabled)

## Manual Release (Fallback)

If automation fails, you can create a release manually:

1. Build extension locally:
   ```bash
   cd src
   zip -r ../linkslinger-v3.0.1.zip .
   ```

2. Go to GitHub → Releases → Draft a new release
3. Tag: `v3.0.1`
4. Title: `LinkSlinger v3.0.1`
5. Upload `linkslinger-v3.0.1.zip`
6. Publish release

## Version Numbering

Follow [Semantic Versioning](https://semver.org/):
- **MAJOR** (3.x.x): Breaking changes
- **MINOR** (x.1.x): New features, backwards compatible
- **PATCH** (x.x.1): Bug fixes, backwards compatible

Examples:
- `3.0.0` - Initial release
- `3.0.1` - Bug fix
- `3.1.0` - New feature
- `4.0.0` - Breaking change

## Release Checklist

Before creating a release:

- [ ] Update version in `src/manifest.json`
- [ ] Test extension locally
- [ ] Update CHANGELOG.md (if maintained)
- [ ] Commit all changes
- [ ] Push to main branch
- [ ] Create and push version tag
- [ ] Verify GitHub Release created
- [ ] Test downloaded `.zip` installs correctly
- [ ] (Optional) Verify Chrome Web Store update

## Chrome Web Store Auto-Publish

To enable automatic publishing to Chrome Web Store:

1. **Get Chrome Web Store API Credentials**:
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Create project: "LinkSlinger Extension"
   - Enable Chrome Web Store API
   - Create OAuth 2.0 Client ID (Desktop app)
   - Download JSON credentials

2. **Get Refresh Token**:
   ```bash
   npm install -g chrome-webstore-upload-cli
   chrome-webstore-upload refresh-token \
     --client-id YOUR_CLIENT_ID \
     --client-secret YOUR_CLIENT_SECRET
   ```

3. **Add GitHub Secrets**:
   - Go to Settings → Secrets and variables → Actions
   - Add secrets:
     - `CHROME_EXTENSION_ID`
     - `CHROME_CLIENT_ID`
     - `CHROME_CLIENT_SECRET`
     - `CHROME_REFRESH_TOKEN`

4. **Enable Workflow**:
   The `chrome-webstore.yml` workflow will automatically run on releases.

## Troubleshooting

### Build Fails

- Check Actions tab → Failed workflow → View logs
- Verify `manifest.json` is valid JSON
- Ensure all required files exist in `src/`

### Release Not Created

- Verify tag format: `vX.Y.Z` (e.g., `v3.0.1`)
- Check version in `manifest.json` matches tag
- Ensure workflow permissions are enabled

### Chrome Web Store Upload Fails

- Verify all secrets are set correctly
- Check extension ID matches Web Store listing
- Ensure OAuth credentials are valid
- Refresh token may need regeneration

**"Unauthorized" / unauthorized_client:** Regenerate refresh token via [OAuth 2.0 Playground](https://developers.google.com/oauthplayground/): use your own credentials, scope `https://www.googleapis.com/auth/chromewebstore`, authorize, exchange for tokens, copy `refresh_token`. Update GitHub secret `CHROME_REFRESH_TOKEN`. Ensure redirect URI `https://developers.google.com/oauthplayground` is added in Google Cloud Console → Credentials → your OAuth client.

**redirect_uri_mismatch:** In Google Cloud Console → APIs & Services → Credentials → your OAuth 2.0 Client ID, add Authorized redirect URI: `https://developers.google.com/oauthplayground`. Save and retry.

---

## Offscreen permission (Chrome Web Store justification)

**Permission:** `offscreen`

**Justification:** Required for clipboard copy in Manifest V3. Service workers cannot use `navigator.clipboard.writeText()`. The offscreen document provides a DOM context for clipboard operations. Used only when the user chooses "Copy" action; no user data stored or transmitted. This is the recommended Chrome MV3 pattern for clipboard access.

---

## Build Artifacts

### On Every Push to Main

- **Artifact**: `linkslinger-extension.zip`
- **Location**: Actions tab → Build Extension → Artifacts
- **Retention**: 30 days

### On Version Tag

- **Release**: `vX.Y.Z`
- **File**: `linkslinger-vX.Y.Z.zip`
- **Location**: Releases section (permanent)

## File Exclusions

The build process excludes:
- `.git/` and `.github/`
- `node_modules/`
- `build/` and `release/`
- `.gitignore`, `README.md`
- `package.json`, `package-lock.json`
- IDE files (`.vscode/`, `.idea/`)
- OS files (`.DS_Store`, `Thumbs.db`)
- Log files (`*.log`)

To customize, edit the `rsync` command in `.github/workflows/build.yml`.
