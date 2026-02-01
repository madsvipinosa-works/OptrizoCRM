---
description: How to push this project to a new GitHub repository
---

# 🚀 How to Upload Your Project to GitHub

Since you have already committed your changes locally, follow these exact steps to push them to your repository **OptrizoCRM**.

## Step 1: Create the Repository (If you haven't yet)
1. Go to: **[https://github.com/new](https://github.com/new)**
2. **Repository name**: `OptrizoCRM`
3. **Initialize**: Do **NOT** check "Add README" or ".gitignore".
4. Click **Create repository**.

## Step 2: Connect and Push
Run these exact commands in your terminal:

```powershell
# 1. Link your local project to your new repo
git remote add origin https://github.com/madsvipinosa-works/OptrizoCRM.git

# 2. Rename branch to 'main'
git branch -M main

# 3. Push your code!
git push -u origin main
```

## ⚠️ Troubleshooting: " Updates were rejected"
If you see an error like `Updates were rejected because the remote contains work`, it means you accidentally initialized the repo with a README or License.

**To fix this (overwrite GitHub with your local code):**
```powershell
git push -u origin main --force
```
