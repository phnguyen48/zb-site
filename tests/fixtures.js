// Shared test setup.
// Every test runs against a local copy of the site with outside services faked, so tests are
// fast, never send real emails/bookings, and never count as real visitors in analytics.
const base = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const FORMSPREE = /^https:\/\/formspree\.io\/f\/[A-Za-z0-9]+$/;
const CALENDLY = 'https://calendly.com/zachbelman/schedule-call-to-discuss-buying-or-selling-real-estate';

/** All listing pages under listings/<slug>/index.html */
function listingSlugs() {
  const dir = path.join(ROOT, 'listings');
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((d) => fs.existsSync(path.join(dir, d, 'index.html')));
}

const test = base.test.extend({
  site: async ({ page }, use) => {
    const site = { formPosts: [], pageErrors: [], missingFiles: [] };

    page.on('pageerror', (err) => site.pageErrors.push(err.message));
    page.on('response', (res) => {
      const u = new URL(res.url());
      if (u.hostname === '127.0.0.1' && res.status() >= 400) site.missingFiles.push(`${res.status()} ${u.pathname}`);
    });

    // Fake outside services
    await page.route(/^https:\/\/formspree\.io\//, async (route) => {
      site.formPosts.push({ url: route.request().url(), body: route.request().postData() || '' });
      await route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
    });
    await page.route(/^https:\/\/calendly\.com\//, (route) =>
      route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>Calendly</title><h1>Calendly scheduler</h1>' }));
    await page.route(/^https:\/\/(www\.googletagmanager\.com|connect\.facebook\.net)\//, (route) =>
      route.fulfill({ status: 200, contentType: 'text/javascript', body: '' }));
    // Anything else outside the site (fonts, trackers, etc.) is blocked so tests stay offline.
    await page.route((u) => u.hostname !== '127.0.0.1' && !/^(formspree\.io|calendly\.com|www\.googletagmanager\.com|connect\.facebook\.net)$/.test(u.hostname),
      (route) => route.abort());

    // Helpers available to tests
    site.fieldValue = (post, name) => {
      const m = post.body.match(new RegExp(`name="${name}"\\r\\n\\r\\n([^\\r]*)`));
      return m ? m[1] : null;
    };
    site.analyticsEvents = () => page.evaluate(() =>
      (window.dataLayer || []).map((a) => Array.from(a)).filter((a) => a[0] === 'event').map((a) => a[1]));
    site.simulateCalendlyBooking = () => page.evaluate(() =>
      window.dispatchEvent(new MessageEvent('message', { origin: 'https://calendly.com', data: { event: 'calendly.event_scheduled' } })));

    await use(site);
  },
});

module.exports = { test, expect: base.expect, listingSlugs, FORMSPREE, CALENDLY, ROOT };
