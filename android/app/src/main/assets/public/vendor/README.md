# vendor/google-genai.bundle.mjs

A self-contained, browser-ready bundle of `@google/genai@1.30.0`'s
browser entry point (`dist/web/index.mjs`), built with esbuild.

**Why this exists instead of importing from esm.sh:** the app's core
voice feature (`chat.html`, `quiz.html`) previously imported this
package at runtime from `https://esm.sh/@google/genai@1.30.0`. That
means every user's device had to reach esm.sh just to load the
feature — if that CDN is ever slow, blocked (some networks/ISPs
restrict third-party CDNs), or down, the core feature breaks for
everyone, even though your own backend and Supabase are perfectly
fine. Vendoring the bundle removes that single point of failure: the
file ships inside the app itself.

## Updating to a newer version

```bash
mkdir /tmp/genai-bundle && cd /tmp/genai-bundle
npm init -y
npm install @google/genai@<new-version> esbuild
npx esbuild node_modules/@google/genai/dist/web/index.mjs \
  --bundle --format=esm --platform=browser \
  --outfile=google-genai.bundle.mjs --minify
cp google-genai.bundle.mjs /path/to/frontend/www/vendor/google-genai.bundle.mjs
```

Then re-test the voice chat and quiz "speak" question flows before
shipping — this bundle is what `chat.html` and `quiz.html` import
`GoogleGenAI`/`Modality` from (see their `<script type="module">`
imports of `./vendor/google-genai.bundle.mjs`).
