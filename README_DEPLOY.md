Cloudflare Pages deployment guide

1. Connect repository to Cloudflare Pages
   - Go to Pages -> Create a project -> Connect to your Git provider and select this repo.
   - For 'Build command' leave empty (no build) unless your site needs one.
   - 'Framework directory' / 'Publish directory': set to repository root (".").
   - Ensure 'Functions' directory is set to "functions" so Pages will expose functions at /api/*.

2. Environment variables (Pages -> Settings -> Environment variables):
   - INQUIRY_TO_EMAIL (optional, default in code provided; use comma-separated addresses for multiple recipients)
   - INQUIRY_BACKUP_EMAIL (optional, default backup recipient is annliao@msourceio.com)
   - EMAIL_PROVIDER (e.g. mailchannels or cloudflare-email-service) or INQUIRY_EMAIL_PROVIDER
   - MAILCHANNELS_API_KEY (if using mailchannels)
   - CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_EMAIL_API_TOKEN (if using Cloudflare email)
   - INQUIRY_FROM_EMAIL (optional)

3. CI/CD (optional):
   - A sample GitHub Actions workflow 'deploy-pages.yml' is added under .github/workflows/ that triggers Pages via the official pages-action. Set secrets CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID in GitHub repository secrets.

4. Worker alternative (optional):
   - A template 'wrangler.toml' is provided if you prefer deploying the API as a Cloudflare Worker. Replace placeholders and run:
     npm i -g wrangler
     wrangler publish
   - For sensitive keys use 'wrangler secret put <NAME>'.

5. Testing after deploy:
   - curl -H "Origin: https://your-site" -H "Content-Type: application/json" -d '{"fullName":"a","emailAddress":"a@b.c","message":"x"}' https://your-site/api/inquiry
   - Expect JSON response with ok:true and CORS headers.

Notes:
- Before production, remove or ignore local-server.js file if unnecessary.
- The client-side local file:// fallback was removed to avoid accidental production routing.
