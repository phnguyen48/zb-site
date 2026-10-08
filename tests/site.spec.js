// Whole-site safety checks: things that would quietly break the site or its compliance.
const fs = require('node:fs');
const path = require('node:path');
const { test, expect, listingSlugs, ROOT } = require('./fixtures');

const pages = ['index.html', 'privacy.html', ...listingSlugs().map((s) => `listings/${s}/index.html`)];
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

test.describe('Site-wide checks', () => {
  for (const p of pages) {
    test(`${p}: no leftover placeholders or links to someone's computer`, () => {
      const html = read(p);
      expect(html).not.toContain('formspree.io/f/YOUR_FORM_ID');
      expect(html).not.toMatch(/file:\/\//);
      expect(html).not.toMatch(/localhost|127\.0\.0\.1/);
    });

    test(`${p}: internal links point to pages and sections that exist`, () => {
      const html = read(p);
      const dir = path.dirname(p);
      for (const [, href] of html.matchAll(/href="([^"]+)"/g)) {
        if (/^(https?:|mailto:|tel:|data:|javascript:)/.test(href)) continue;
        const [file, hash] = href.split('#');
        if (file) {
          const target = file.startsWith('/') ? path.join(ROOT, file) : path.join(ROOT, dir, file);
          const resolved = fs.existsSync(target) && fs.statSync(target).isDirectory() ? path.join(target, 'index.html') : target;
          expect(fs.existsSync(resolved), `link "${href}" in ${p}`).toBe(true);
        } else if (hash) {
          expect(html.includes(`id="${hash}"`), `section "#${hash}" in ${p}`).toBe(true);
        }
      }
    });
  }

  for (const p of ['index.html', ...listingSlugs().map((s) => `listings/${s}/index.html`)]) {
    test(`${p}: has analytics, Meta Pixel and license number`, () => {
      const html = read(p);
      expect(html).toContain("gtag('config', 'G-");
      expect(html).toMatch(/fbq\('init', '\d{10,}'\)/);
      expect(html).toContain('DRE #02165828');
      expect(html).toContain('privacy.html');
    });
  }

  for (const p of ['index.html', ...listingSlugs().map((s) => `listings/${s}/index.html`)]) {
    test(`${p}: has a link preview image for social media and texts`, () => {
      const html = read(p);
      const img = html.match(/<meta property="og:image" content="([^"]+)"/);
      expect(img, 'og:image tag').not.toBeNull();
      expect(img[1]).toMatch(/^https:\/\/zachbelman\.com\//);
      const local = path.join(ROOT, img[1].replace('https://zachbelman.com/', ''));
      expect(fs.existsSync(local), `preview image ${img[1]} exists in the repository`).toBe(true);
      expect(html).toMatch(/<meta property="og:title" content="[^"]+"/);
      expect(html).toContain('<meta name="twitter:card" content="summary_large_image">');
    });
  }

  test('homepage stays fast: small page file, photos as separate files that load as you scroll', () => {
    const html = read('index.html');
    expect(Buffer.byteLength(html), 'index.html size in bytes').toBeLessThan(300 * 1024);
    expect(html, 'no large photos embedded inside the page').not.toMatch(/src="data:image\/(jpeg|png);base64,[A-Za-z0-9+/=]{20000,}/);
    const imgs = [...html.matchAll(/<img\b[^>]*>/g)].map((m) => m[0]);
    const eager = imgs.filter((t) => !/loading="lazy"/.test(t));
    expect(eager.length, 'only the top-of-page photo should load immediately').toBeLessThanOrEqual(2);
  });

  test('homepage footer has the disclaimer and REALTOR/MLS + Equal Housing logos', async ({ page }) => {
    await page.goto('/');
    const legal = page.locator('.legal');
    await expect(legal).toContainText('deemed reliable but not guaranteed');
    await expect(legal.locator('img[alt*="REALTOR"]')).toBeAttached();
    await expect(legal.locator('img[alt="Equal Housing Opportunity"]')).toBeAttached();
  });

  test('privacy policy page loads', async ({ page }) => {
    const res = await page.goto('/privacy.html');
    expect(res.status()).toBe(200);
    await expect(page.locator('h1')).toHaveText('Privacy Policy');
  });

  test('visitors with Global Privacy Control turned on do not get the Meta Pixel', async ({ browser }) => {
    const ctx = await browser.newContext();
    await ctx.addInitScript(() => Object.defineProperty(navigator, 'globalPrivacyControl', { get: () => true }));
    const page = await ctx.newPage();
    await page.route((u) => u.hostname !== '127.0.0.1', (r) => r.abort());
    await page.goto('/');
    expect(await page.evaluate(() => typeof window.fbq)).toBe('undefined');
    await ctx.close();
  });

  test('market data file is valid and has Bay Area cities and ZIP codes', () => {
    const data = JSON.parse(read('market.json'));
    expect(Object.keys(data.cities).length).toBeGreaterThanOrEqual(20);
    expect(Object.keys(data.zips).length).toBeGreaterThanOrEqual(20);
    expect(data.cities['San Jose'].p).toBeGreaterThan(100000);
    expect(data.updated).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
