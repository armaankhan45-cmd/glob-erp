# 🚀 GLOB ERP — FREE Website Deployment Guide
## Step-by-Step for Beginners (No Technical Knowledge Needed)

---

## STEP 1: Create FREE Database (10 minutes)

### What you're doing: Creating an online database to store all your data

1. Open browser → Go to **https://neon.tech**
2. Click **"Sign Up"** → Sign up with Google
3. After login, click **"Create Project"**
4. Project name: type `glob-erp`
5. Region: select **Mumbai (ap-south-1)** 
6. Click **"Create Project"**
7. ⭐ IMPORTANT: You'll see a **Connection String** that looks like:
   ```
   postgresql://neondb_owner:AbCdEfGh@ep-cool-name-12345.ap-south-1.aws.neon.tech/neondb?sslmode=require
   ```
8. **COPY THIS ENTIRE STRING** and save it in a notepad file. You'll need it later.
   - This is your **DATABASE_URL**

✅ Step 1 Done! You have a free database.

---

## STEP 2: Upload Code to GitHub (15 minutes)

### What you're doing: Putting your code online so hosting services can access it

### 2A. Install Git
1. Go to **https://git-scm.com/downloads**
2. Download and install Git for your OS (Windows/Mac)
3. During installation, just click "Next" on everything (default settings are fine)

### 2B. Create GitHub Account
1. Go to **https://github.com**
2. Click **"Sign Up"** → Create free account

### 2C. Create Repository
1. On GitHub, click **"New"** (green button) or **"+" → "New repository"**
2. Repository name: `glob-erp`
3. Select **"Private"** (only you can see it)
4. Click **"Create repository"**

### 2D. Upload Your Code
1. Open the `erp-web` folder on your computer
2. Right-click inside the folder → **"Open in Terminal"** (or "Git Bash Here")
3. Type these commands ONE BY ONE, pressing Enter after each:

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/glob-erp.git
git push -u origin main
```

**Replace YOUR-USERNAME** with your actual GitHub username.

4. It will ask for GitHub login → enter your username and password
   - If password doesn't work, use a **Personal Access Token**:
     - Go to GitHub → Settings → Developer Settings → Personal Access Tokens → Generate New Token
     - Select "repo" scope → Generate → Copy token → Use as password

5. Go to your GitHub repo page → You should see all your code files!

✅ Step 2 Done! Your code is on GitHub.

---

## STEP 3: Host Backend on Render (15 minutes)

### What you're doing: Making your API (server) live on the internet

1. Go to **https://render.com**
2. Click **"Get Started"** → Sign up with **GitHub**
3. After login, click **"New +"** → Select **"Web Service"**
4. You'll see your GitHub repos → Click **"Connect"** on `glob-erp`
5. Fill in the form:

| Field | What to Type |
|-------|-------------|
| **Name** | `glob-erp-api` |
| **Root Directory** | `backend` |
| **Runtime** | `Node` |
| **Build Command** | `npm install` |
| **Start Command** | `npm start` |
| **Instance Type** | `Free` |

6. ⭐ SCROLL DOWN to **"Environment Variables"** → Click **"Add Environment Variable"** for each:

| Key | Value |
|-----|-------|
| `DATABASE_URL` | *(paste your Neon connection string from Step 1)* |
| `JWT_SECRET` | `my-super-secret-key-change-this-12345678` |
| `CORS_ORIGIN` | `https://glob-erp.vercel.app` |
| `NODE_ENV` | `production` |
| `PORT` | `5000` |

7. Click **"Create Web Service"**
8. ⏳ Wait 3-5 minutes (it's installing and starting)
9. When it says **"Live"** at the top, your backend is running!
10. ⭐ Copy your backend URL from the top (it looks like `https://glob-erp-api.onrender.com`)
11. Test it: Open that URL + `/api/health` in browser → You should see `{"success":true}`

✅ Step 3 Done! Your backend API is live.

---

## STEP 4: Host Frontend on Vercel (10 minutes)

### What you're doing: Making your website (what users see) live

1. Go to **https://vercel.com**
2. Click **"Sign Up"** → Sign up with **GitHub**
3. After login, click **"Add New..." → "Project"**
4. You'll see your repos → Click **"Import"** on `glob-erp`
5. Fill in the form:

| Field | What to Type |
|-------|-------------|
| **Project Name** | `glob-erp` |
| **Root Directory** | Click "Edit" → type `frontend` |
| **Framework Preset** | `Vite` (should auto-detect) |

6. ⭐ SCROLL DOWN to **"Environment Variables"** → Add one:

| Key | Value |
|-----|-------|
| `VITE_API_URL` | `https://glob-erp-api.onrender.com/api` *(use YOUR render URL from Step 3)* |

7. Click **"Deploy"**
8. ⏳ Wait 2-3 minutes
9. When done, you'll see your website URL! (like `https://glob-erp.vercel.app`)
10. Click the URL → **YOUR WEBSITE IS LIVE!** 🎉

✅ Step 4 Done! Your website is live on the internet!

---

## STEP 5: Set Up Database Tables (5 minutes)

### What you're doing: Creating the tables in your database

1. Go back to **https://neon.tech** → Your `glob-erp` project
2. Click **"SQL Editor"** in the sidebar
3. We need to run the migration. Instead, let's use Render's shell:

   **Option A - Using Render Shell:**
   1. Go to **https://dashboard.render.com**
   2. Click on your `glob-erp-api` service
   3. Click **"Shell"** tab in the top menu
   4. Wait for the shell to load
   5. Type: `npx knex migrate:latest --knexfile knexfile.js`
   6. Press Enter → Tables created!
   7. Type: `npx knex seed:run --knexfile knexfile.js`
   8. Press Enter → Demo data added!

   **Option B - If Shell doesn't work:**
   1. Go to **https://neon.tech** → Your project
   2. Click **"Tables"** → You can see the tables
   3. Or use **"SQL Editor"** to run the migration SQL manually

4. Now go to your website: `https://glob-erp.vercel.app`
5. Click **"Login"**
6. Email: `admin@globfabrication.com`
7. Password: `admin123`
8. **YOU'RE IN!** 🎉🎉🎉

---

## 🌐 OPTIONAL: Add Custom Domain

If you own `globfabrication.com`:

### For Frontend (Vercel):
1. Go to your Vercel project → **Settings → Domains**
2. Type `erp.globfabrication.com`
3. Click **"Add"**
4. Go to your domain registrar (GoDaddy/Namecheap etc.)
5. Add a **CNAME** record:
   - Name: `erp`
   - Value: `cname.vercel-dns.com`
6. Wait 5-30 minutes → HTTPS is auto-configured!

### For Backend (Render):
1. Go to Render → Your service → **Settings**
2. Scroll to **"Custom Domains"**
3. Type `api.globfabrication.com`
4. Add **CNAME** record at your registrar:
   - Name: `api`
   - Value: `glob-erp-api.onrender.com`
5. Update `CORS_ORIGIN` env var to `https://erp.globfabrication.com`
6. Update `VITE_API_URL` env var to `https://api.globfabrication.com/api`

---

## 💰 COMPLETELY FREE! Here's what you get:

| Service | Free Tier | Limits |
|---------|----------|--------|
| **Neon Database** | 0.5 GB storage | Enough for thousands of invoices |
| **Render Backend** | 750 hours/month | Sleeps after 15min idle (wakes in 30s) |
| **Vercel Frontend** | Unlimited | Always fast, never sleeps |

---

## ⚠️ COMMON ISSUES & FIXES

### "Site not loading?"
- Wait 2-3 minutes after deployment
- Check if Render backend shows "Live" status
- Clear browser cache (Ctrl+Shift+R)

### "API errors?"
- Check `VITE_API_URL` in Vercel has your CORRECT Render URL
- Make sure `CORS_ORIGIN` in Render matches your Vercel URL
- Check Render logs for errors

### "Database connection failed?"
- Make sure `DATABASE_URL` is exactly right (copy from Neon dashboard)
- Make sure it includes `?sslmode=require` at the end

### "Can't login?"
- Make sure you ran the seed command in Step 5
- Try registering a new account

### "Render backend sleeping?"
- Free tier sleeps after 15 min of no requests
- First request after sleep takes ~30 seconds to wake up
- This is normal and FREE! Just wait a moment.

---

## 📱 YOUR WEBSITE FEATURES

Once live, anyone can:
1. **Open** `your-url.vercel.app` in ANY browser (phone/computer/tablet)
2. **Register** their own organization
3. **Login** and use the full ERP
4. **Create invoices, quotations, track GST** — everything!
5. **Print** directly from browser
6. **Export** to Excel
7. **Multiple users** in same organization

---

## 🔄 HOW TO UPDATE CODE LATER

When you make changes to the code:

```bash
# In your erp-web folder, open terminal
git add .
git commit -m "Updated something"
git push
```

Vercel and Render will **automatically redeploy** within 2-3 minutes! No need to do anything else.

---

## 🆘 NEED HELP?

If something goes wrong:
1. **Render Logs**: Dashboard → Your Service → Logs tab
2. **Vercel Logs**: Dashboard → Your Project → Deployments → Click latest
3. **Neon Dashboard**: Check connection string and tables

---

**🎉 That's it! Your Glob ERP is now a LIVE WEBSITE accessible from anywhere in the world!**
