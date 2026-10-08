// Every listing page under listings/ gets the same checks automatically.
const { test, expect, listingSlugs, FORMSPREE, CALENDLY } = require('./fixtures');

const slugs = listingSlugs();

test('there is at least one listing page to test', () => {
  expect(slugs.length).toBeGreaterThan(0);
});

for (const slug of slugs) {
  test.describe(`Listing: ${slug}`, () => {
    test.beforeEach(async ({ page }) => {
      await page.goto(`/listings/${slug}/`);
      await expect(page.locator('#addr')).not.toBeEmpty();
    });

    test.afterEach(async ({ site }) => {
      expect(site.pageErrors, 'JavaScript errors on the page').toEqual([]);
      expect(site.missingFiles, 'Photos or files that are missing').toEqual([]);
    });

    test('shows price, details, attribution and both action buttons', async ({ page }) => {
      await expect(page.locator('#price')).toHaveText(/^\$[\d,]+$/);
      await expect(page.locator('#facts')).toContainText('bd');
      await expect(page.locator('#attrib')).toContainText('Listing courtesy of');
      await expect(page.locator('body')).toContainText('DRE #02165828');
      await expect(page.getByRole('button', { name: 'Request a tour' }).first()).toBeAttached();
      await expect(page.getByRole('link', { name: 'Book a call with Zach' })).toBeAttached();
    });

    test('all photos load', async ({ page }) => {
      const imgs = page.locator('#photos img');
      const n = await imgs.count();
      for (let i = 0; i < n; i++) {
        const img = imgs.nth(i);
        await img.scrollIntoViewIfNeeded();
        await expect.poll(() => img.evaluate((el) => el.complete && el.naturalWidth > 0), { message: `photo ${i + 1} loads` }).toBe(true);
      }
    });

    test('"Request a tour" form submits and shows a confirmation', async ({ page, site }) => {
      const tourBtn = page.locator('#tourBtn:visible, #mctaBtn:visible').first();
      await tourBtn.click();
      await expect(page.locator('#tourView')).toBeVisible();
      await page.getByRole('button', { name: 'Next week' }).click();
      await page.getByRole('button', { name: 'No', exact: true }).click();
      await page.fill('#fName', 'Test Buyer');
      await page.fill('#fEmail', 'test.buyer@example.com');
      await page.click('#submitBtn');

      await expect(page.locator('#thanks')).toBeVisible();
      await expect(page.locator('#thanks')).toContainText('Request sent');
      expect(site.formPosts).toHaveLength(1);
      const post = site.formPosts[0];
      expect(post.url).toMatch(FORMSPREE);
      expect(site.fieldValue(post, 'email')).toBe('test.buyer@example.com');
      expect(site.fieldValue(post, 'when')).toBe('Next week');
      expect(site.fieldValue(post, 'has_agent')).toBe('No');
      expect(site.fieldValue(post, 'listing')).toMatch(/MLS# /);
      expect(await site.analyticsEvents()).toContain('generate_lead');
    });

    test('"Request a tour" form blocks a missing email', async ({ page, site }) => {
      await page.locator('#tourBtn:visible, #mctaBtn:visible').first().click();
      await page.fill('#fName', 'Test Buyer');
      await page.click('#submitBtn');
      await expect(page.locator('#formStatus')).toBeVisible();
      expect(site.formPosts).toHaveLength(0);
    });

    test('"Book a call with Zach" opens Calendly, and a booking shows a confirmation', async ({ page, site }) => {
      const link = page.getByRole('link', { name: 'Book a call with Zach' });
      await link.scrollIntoViewIfNeeded();
      await link.click();
      await expect(page.locator('#bookModal')).toHaveClass(/open/);
      expect(await page.locator('#bookFrame').getAttribute('src')).toContain(CALENDLY);
      await site.simulateCalendlyBooking();
      await expect(page.locator('#bookDone')).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(page.locator('#bookModal')).not.toHaveClass(/open/);
    });

    test('payment estimate uses the latest daily mortgage rates', async ({ page }) => {
      const rates = JSON.parse(require('node:fs').readFileSync(require('node:path').join(__dirname, '..', 'rates.json'), 'utf8'));
      await page.locator('#payBox summary').click();
      await expect(page.locator('#pRate')).toHaveValue(String(rates.rate30));
      await expect(page.locator('#payDisc')).toContainText('30-year average, week of');
      await page.selectOption('#pTerm', '15');
      await expect(page.locator('#pRate')).toHaveValue(String(rates.rate15));
      await expect(page.locator('#payDisc')).toContainText('15-year average');
    });

    test('monthly payment estimate works and leads to the tour form', async ({ page }) => {
      const total = page.locator('#payTotal');
      await expect(total).toHaveText(/^\$[\d,]+\/mo$/);
      const before = Number((await total.innerText()).replace(/[^\d]/g, ''));
      await page.locator('#payBox summary').click();
      await page.fill('#pDown', '10');
      await expect(page.locator('#payRows')).toContainText('Mortgage insurance');
      const after = Number((await total.innerText()).replace(/[^\d]/g, ''));
      expect(after, 'less down payment = higher monthly payment').toBeGreaterThan(before);
      await page.click('#financeBtn');
      await expect(page.locator('#tourView')).toBeVisible();
      await expect(page.locator('#showForm textarea[name="message"]')).toHaveValue(/financing/);
    });

    test('page fits the screen width (no sideways scrolling)', async ({ page }) => {
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow).toBeLessThanOrEqual(1);
    });
  });
}
