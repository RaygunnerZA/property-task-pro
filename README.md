# Welcome to your Lovable project

## Project info 

**URL**: https://lovable.dev/projects/4f11452d-2715-4234-9262-39e60794cb21

## How can I edit this code?

There are several ways of editing your application. 

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/4f11452d-2715-4234-9262-39e60794cb21) and start prompting.

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

### Supabase types

Frontend typing is driven by generated types from the live public schema (`src/types/supabase.ts`). To avoid schema/type drift after DB changes, regenerate with:

```sh
npm run gen:types
```

Requires the Supabase CLI and a linked project (`supabase link`), or run the generator manually with your project ID and redirect output to `src/types/supabase.ts`.

## How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/4f11452d-2715-4234-9262-39e60794cb21) and click on Share -> Publish.

### Auth on Vercel (production)

For sign-up, email confirmation, password reset, and invites to work for users on your live Vercel app:

1. **Vercel**
   - Project → **Settings** → **Environment Variables**
   - Add: **Name** `VITE_APP_URL`, **Value** `https://property-task-pro.vercel.app` (or your actual Vercel URL; no trailing slash)
   - Apply to **Production** (and **Preview** if you use preview deployments)
   - **Redeploy** the project (env vars are baked in at build time)

2. **Supabase**
   - [Dashboard](https://supabase.com/dashboard) → your project → **Authentication** → **URL Configuration**
   - **Site URL:** `https://property-task-pro.vercel.app` (same as above)
   - **Redirect URLs:** add these (one per line or comma-separated, depending on UI):
     - `https://property-task-pro.vercel.app/verify`
     - `https://property-task-pro.vercel.app/login`
     - `https://property-task-pro.vercel.app/accept-invitation`
     - `https://property-task-pro.vercel.app/**` (wildcard is optional but covers any path)
   - Save

3. **Invite emails (optional)**  
   If you use the invite-team-member Edge Function: Supabase → **Project Settings** → **Edge Functions** → set secret `SITE_URL` to `https://property-task-pro.vercel.app`

After this, users who sign up or reset password on the Vercel app will get email links that open on your Vercel domain, not localhost.

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/features/custom-domain#custom-domain)
