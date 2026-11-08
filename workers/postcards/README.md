# Postcards: the post office

A small Cloudflare Worker that holds the postcards visitors write on saumyalahera.com.
New postcards wait until you pin them from the Leabhar app. Only pinned ones appear on the site.
The Postcards section stays hidden on the website until this worker answers.

## Set it up once

Run these from this folder (`workers/postcards`), signed in to the same Cloudflare account as `portfolio-json`:

1. Make the storage, then paste the `id` it prints into `wrangler.toml`:

   ```
   npx wrangler kv namespace create POSTCARDS
   ```

2. Set the password Leabhar uses to pin postcards. Use **the same token you saved in Leabhar**,
   so the app can use it without asking again:

   ```
   npx wrangler secret put ADMIN_TOKEN
   ```

3. Publish it:

   ```
   npx wrangler deploy
   ```

It should come up at `https://postcards.laherasaumya.workers.dev`. If Cloudflare gives it a different
address, change `POST_URL` in `notebook.js` and `PostcardsStore.baseURL` in Leabhar to match.
