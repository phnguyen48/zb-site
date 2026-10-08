# Website

- `index.html`: the website
- `market.json`: market numbers for every Bay Area city and ZIP code. **Created and updated automatically; don't edit it by hand.**
- `scripts/update_market.py`: downloads Redfin's free market data and writes `market.json`
- `.github/workflows/update-market.yml`: runs that script every day
- `rates.json`: latest Freddie Mac mortgage rates for the listing pages' payment estimate. **Updated automatically every day; don't edit by hand.**
- `scripts/update_rates.py` and `.github/workflows/update-rates.yml`: refresh `rates.json` every morning
- `tests/`: automated checks that must pass before the site is published (see below)
- `.github/workflows/deploy.yml`: runs the tests, then publishes the site

## Day to day

- **Market numbers:** these update themselves every day. Redfin refreshes its data about once a month, so the numbers change monthly.
- **Changing the site:** open `index.html` on GitHub, click the pencil icon to edit or upload a replacement, and commit. The tests run first (about 3 minutes); if they pass, the live site updates.
- If GitHub ever emails that a scheduled workflow was disabled, open the **Actions** tab and click **Enable workflow**.
- If a run ever fails because Redfin changed its file format, the site keeps showing the last good numbers.

## Automated tests

Every change pushed to GitHub runs the tests in `tests/` (in a real browser, on desktop and phone sizes) before the site is published. **If any test fails, the live site is not updated.** You'll see a red ✗ on the **Actions** tab, and GitHub emails you.

What's checked:
- **Contact form:** sends to Formspree with the visitor's details, shows the thank-you message, and blocks empty or invalid entries
- **Book a Call:** every "Book a Call" button opens Zach's Calendly, and a booking shows "You're booked!"
- **Contact buttons:** every "Get in Touch"-style button scrolls to the contact form and pre-selects the right topic
- **Social sections:** at least 3 YouTube videos and 6 Instagram posts
- **Market lookup:** shows numbers for a city and a ZIP code, and `market.json` is valid
- **Every listing page in `listings/`:** photos load; price, attribution and both buttons are present; "Request a tour" sends and confirms; "Book a call with Zach" opens Calendly
- **Whole site:** no JavaScript errors, missing files or broken internal links; no leftover placeholders or links to someone's computer; analytics, Meta Pixel, DRE number and privacy policy are on every page; visitors with Global Privacy Control don't get the Meta Pixel; nothing scrolls sideways on phones

Tests use fake versions of Formspree, Calendly, Google and Meta, so they never send real emails or bookings and don't count as visits.

To run them on your own computer (optional): `npm install`, then `npx playwright install chromium`, then `npm test`.
