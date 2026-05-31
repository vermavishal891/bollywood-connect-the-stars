# 🚀 Deployment Guide

Free deployment stack:
- **Frontend** → [Vercel](https://vercel.com) (free, permanent, no sleep)
- **Backend API** → [Render](https://render.com) (free, sleeps after 15min inactivity)
- **Database** → [Supabase](https://supabase.com) (free 500MB tier, already migrated!)

---

## 1. Database (Supabase) — Already Done ✅

Your PostgreSQL database is live at Supabase with all ~32K rows migrated.

**Connection string** (set this in Render later):
```
postgresql://postgres:CChLrrwZwe1eINNS@db.kanzaopkrljiwbwahzus.supabase.co:5432/postgres
```

---

## 2. Deploy API to Render

### Step 2a: Create Render Account
1. Go to [render.com](https://render.com) → Sign up with GitHub

### Step 2b: Create Web Service
1. Dashboard → **New +** → **Web Service**
2. Connect your GitHub repo: `vermavishal891/bollywood-connect-the-stars`
3. Configure:
   - **Name**: `bollywood-connect-api`
   - **Region**: Choose closest to your users (e.g., Singapore for India)
   - **Branch**: `main`
   - **Runtime**: `Node`
   - **Build Command**:
     ```bash
     npm install && npm run db:generate -w @bollywood-connect/db && npm run build --workspaces
     ```
   - **Start Command**:
     ```bash
     npm run start -w @bollywood-connect/api
     ```
   - **Plan**: `Free`

4. **Environment Variables** → Add:
   | Key | Value |
   |-----|-------|
   | `DATABASE_URL` | `postgresql://postgres:CChLrrwZwe1eINNS@db.kanzaopkrljiwbwahzus.supabase.co:5432/postgres` |
   | `PORT` | `10000` |
   | `NODE_ENV` | `production` |
   | `CORS_ORIGIN` | *(leave empty for now, we'll update after Vercel deploy)* |

5. Click **Create Web Service**

6. Wait for build (~2-3 min). You'll get a URL like:
   ```
   https://bollywood-connect-api.onrender.com
   ```

---

## 3. Deploy Frontend to Vercel

### Step 3a: Create Vercel Account
1. Go to [vercel.com](https://vercel.com) → Sign up with GitHub

### Step 3b: Import Project
1. Dashboard → **Add New...** → **Project**
2. Import `bollywood-connect-the-stars` from GitHub
3. Configure:
   - **Framework Preset**: `Next.js`
   - **Root Directory**: `.` *(repo root — it's a monorepo)*
   - **Build Command**:
     ```bash
     npm install && npm run db:generate -w @bollywood-connect/db && npm run build --workspaces
     ```
   - **Output Directory**: `apps/web/.next`
   - **Install Command**: `npm install`

4. **Environment Variables** → Add:
   | Key | Value |
   |-----|-------|
   | `NEXT_PUBLIC_API_URL` | `https://bollywood-connect-api.onrender.com` *(use your actual Render URL)* |

5. Click **Deploy**

6. Wait for build (~2-3 min). You'll get a URL like:
   ```
   https://bollywood-connect.vercel.app
   ```

---

## 4. Final CORS Setup

Go back to Render dashboard → your API service → **Environment**:

Update `CORS_ORIGIN` to your Vercel URL(s):
```
https://bollywood-connect.vercel.app,https://bollywood-connect-git-main.vercel.app
```

*(Include the git-branch URL too — Vercel generates preview URLs)*

Then **Manual Deploy** → **Deploy latest commit** to restart with new CORS.

---

## 5. Verify Everything Works

Open your Vercel URL and test:
- [ ] Create a new game
- [ ] Make moves
- [ ] Undo / Reset
- [ ] Hints
- [ ] Win screen

If the API is sleeping (first request after 15min), it may take ~30s to wake up. Subsequent requests will be fast.

---

## 🔄 Updating After Code Changes

Just `git push` to `main`. Both Render and Vercel auto-deploy on push.

```bash
git add .
git commit -m "your changes"
git push origin main
```

---

## 📋 Troubleshooting

| Issue | Fix |
|-------|-----|
| `DATABASE_URL` not found | Double-check env var in Render dashboard |
| CORS errors in browser | Update `CORS_ORIGIN` in Render with exact Vercel URL |
| API sleeps too slow | This is Render free tier — normal. Upgrade to paid ($7/mo) for no sleep. |
| Build fails on Vercel | Check build logs — usually a missing workspace build step |
| Prisma errors | Make sure `npm run db:generate` runs before `npm run build` |
