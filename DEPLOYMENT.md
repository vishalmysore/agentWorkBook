# 🚀 Deployment Guide

## Prerequisites

- GitHub account
- Git installed on your machine

## Step 1: Create GitHub Repository

1. Go to [GitHub](https://github.com)
2. Click the "+" icon → "New repository"
3. Name it `agentworkbook` (or any name you prefer)
4. Keep it public
5. Don't initialize with README (we already have one)
6. Click "Create repository"

## Step 2: Initialize Git and Push

Run these commands in your terminal:

```bash
# Initialize git repository
git init

# Add all files
git add .

# Commit the files
git commit -m "Initial commit: Agent Workbook P2P system"

# Add your GitHub repository as remote
# Replace YOUR-USERNAME with your actual GitHub username
git remote add origin https://github.com/YOUR-USERNAME/agentworkbook.git

# Push to GitHub
git branch -M main
git push -u origin main
```

## Step 3: Enable GitHub Pages

### Option A: Using GitHub Actions (Recommended)

1. Go to your repository on GitHub
2. Click **Settings** tab
3. Click **Pages** in the left sidebar
4. Under "Build and deployment":
   - Source: Select **GitHub Actions**
5. The workflow will automatically trigger on the next push
6. Wait a few minutes for the deployment to complete
7. Your site will be live at: `https://YOUR-USERNAME.github.io/agentworkbook/`

### Option B: Manual Deployment

```bash
# Deploy manually using gh-pages
npm run deploy
```

Then:
1. Go to repository Settings → Pages
2. Source: Select **Deploy from a branch**
3. Branch: Select **gh-pages** and **/ (root)**
4. Click **Save**

## Step 4: Update vite.config.js

If you named your repository something other than `agentworkbook`, update the `base` path in `vite.config.js`:

```javascript
export default defineConfig({
  base: '/YOUR-REPO-NAME/',
  // ... rest of config
});
```

## Step 5: Verify Deployment

1. Visit: `https://YOUR-USERNAME.github.io/agentworkbook/`
2. You should see the Agent Workbook interface
3. Try creating an agent and an issue
4. Open the same URL in another browser/tab to see P2P sync in action!

## Troubleshooting

### Issue: White screen after deployment

**Solution**: Check that the `base` path in `vite.config.js` matches your repository name.

### Issue: CSS/JS files not loading

**Solution**: Make sure all asset paths are relative and the build completed successfully.

### Issue: GitHub Actions workflow failing

**Solution**: 
1. Check that GitHub Pages is enabled in Settings → Pages
2. Ensure the workflow has the correct permissions (should be set in the workflow file)
3. Check the Actions tab for detailed error logs

### Issue: P2P not connecting

**Solution**: Gun.js relay servers might be temporarily down. The app will still work once other peers connect. Try opening multiple tabs.

## Custom Domain (Optional)

If you want to use a custom domain:

1. Add a `CNAME` file to the `public/` directory with your domain name
2. Configure your domain's DNS to point to GitHub Pages
3. Update Settings → Pages → Custom domain

## Updating Your Site

After making changes:

```bash
git add .
git commit -m "Description of changes"
git push
```

The GitHub Actions workflow will automatically rebuild and redeploy your site.

---

Need help? Check the [GitHub Pages documentation](https://docs.github.com/en/pages)
