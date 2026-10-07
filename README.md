# Website

- `index.html`: the website
- `market.json`: market numbers for every Bay Area city and ZIP code. **Created and updated automatically; don't edit it by hand.**
- `scripts/update_market.py`: downloads Redfin's free market data and writes `market.json`
- `.github/workflows/update-market.yml`: runs that script every 3 days

## Day to day

- **Market numbers:** these update themselves every 3 days. Redfin refreshes its data about once a month, so the numbers change monthly.
- **Changing the site:** open `index.html` on GitHub, click the pencil icon to edit or upload a replacement, and commit. The live site updates within a minute or two.
- If GitHub ever emails that a scheduled workflow was disabled, open the **Actions** tab and click **Enable workflow**.
- If a run ever fails because Redfin changed its file format, the site keeps showing the last good numbers.
