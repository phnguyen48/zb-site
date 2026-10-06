# Zach Belman website

- `index.html`: the website
- `market.json`: market numbers for every Bay Area city and ZIP code. **Created and updated automatically; don't edit it by hand.**
- `scripts/update_market.py`: downloads Redfin's free market data and writes `market.json`
- `.github/workflows/update-market.yml`: runs that script every 3 days

## One-time setup (GitHub Pages, free)

1. Create a free account at github.com.
2. Click **+ → New repository**. Name it, e.g. `zachbelman-site`, set it to **Public**, and click **Create**.
3. Add these files to the repository:
   - **Easiest:** tell Claude the repository name and it can upload everything for you.
   - **Or by hand:** use **Add file → Upload files** and drag in `index.html`, `README.md` and the `scripts` folder, then click **Commit**. Next, use **Add file → Create new file**, type the name `.github/workflows/update-market.yml`, paste in that file's contents and click **Commit**. (The `.github` folder is hidden on Mac, which is why it's added this way.)
4. Get the first round of numbers: open the **Actions** tab, click **Update market numbers**, then **Run workflow**. It takes about 10–20 minutes, and when it finishes, `market.json` appears in your files.
5. Turn the site on: go to **Settings → Pages → Build and deployment**, choose **Deploy from a branch**, then **main** and **/ (root)**, and click **Save**. About a minute later your site is live at `https://<your-username>.github.io/zachbelman-site/`.
6. Use your own domain: in **Settings → Pages → Custom domain**, enter it (e.g. `zachbelman.com`) and click Save. Then, where you bought the domain, add these DNS records:
   - four **A** records for `@` pointing to `185.199.108.153`, `185.199.109.153`, `185.199.110.153` and `185.199.111.153`
   - one **CNAME** record for `www` pointing to `<your-username>.github.io`

   Once GitHub shows the domain as verified, tick **Enforce HTTPS**.

## Day to day

- **Market numbers:** these update themselves every 3 days. Redfin refreshes its data about once a month, so the numbers change monthly.
- **Changing the site:** open `index.html` on GitHub, click the pencil icon to edit or upload a replacement, and commit. The live site updates within a minute or two.
- If GitHub ever emails that a scheduled workflow was disabled, open the **Actions** tab and click **Enable workflow**.
- If a run ever fails because Redfin changed its file format, the site keeps showing the last good numbers.
