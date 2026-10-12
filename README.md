# Aangi's UK Passport

A static, shared birthday journal for **https://aangi.space**. There is no login. Anyone who can reach the site can read and edit the same passport, including its photos.

## Files

- `index.html`: the cover, identity page, twenty editable pages, missions, and birthday letter.
- `cloud.js`: cloud saving, background refresh, offline drafts, and explicit conflict resolution.
- `cloud-core.js`: photo hashing, upload references, and local photo recovery.
- `config.js`: the Supabase URL and public publishable key. No database password belongs here.
- `supabase.sql`: the initial database and Storage setup, to run once.
- `supabase.js`: locally bundled Supabase JavaScript client 2.117.3.
- `CNAME`: the requested domain, `aangi.space`.

## Supabase

Run `supabase.sql` once in the project's SQL editor. It creates a single shared journal, a revision-checked save function, and a public photo bucket with upload policies. No authentication setup is required.

Notes and mission stamps are saved in the journal row. Photos are resized on upload, then saved under a SHA-256 filename in Supabase Storage. The database stores photo paths rather than image data. IndexedDB keeps complete local drafts so edits can survive a lost connection; after reconnecting, the app retries saving. If another device has changed the journal, it offers an explicit choice and a backup button instead of silently overwriting it.

The app refreshes cloud changes every 30 seconds while open. Offline drafts require the page to have loaded; a completely offline first visit is not supported. Removed photos are detached from the journal but kept in Storage, so an older backup can still recover them. The bucket limits each file to 5 MiB. Configure Supabase billing/spend controls as desired for a public upload endpoint.

## GitHub Pages and aangi.space

1. Push this folder's contents to the `main` branch of `Yajat0747/UKPASS`.
2. In repository **Settings → Pages**, choose **Deploy from a branch**, then `main` and `/ (root)`. This project has no build step.
3. Set the custom domain to `aangi.space`.
4. At the domain's DNS provider, use the following apex `A` records:

   | Host | Value |
   | --- | --- |
   | @ | 185.199.108.153 |
   | @ | 185.199.109.153 |
   | @ | 185.199.110.153 |
   | @ | 185.199.111.153 |

5. Verify the domain with GitHub's TXT record and enable **Enforce HTTPS** once the certificate is available. Use the exact verification value shown by GitHub; it cannot be prefilled here.

Official domain instructions: https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site

## Backups and printing

Download backup includes notes, photo data, stamps, and navigation state in a JSON file. Restore deliberately replaces the current draft and syncs that choice to the shared passport. Print / save PDF opens the browser's print dialog; select Save as PDF. No third-party PDF service receives the journal.

## Local preview

Serve the folder with `python -m http.server 8000`, then open `http://localhost:8000`. Opening `index.html` directly as a file does not support the JavaScript modules.

## Checks

Run `node --test cloud-core.test.mjs` to check photo deduplication, round-trip recovery, rejected paths, and upload failures. Production cloud saving must also be checked against the configured Supabase project after applying the schema.

