// Homepage: the features that bring in leads.
const { test, expect, FORMSPREE, CALENDLY } = require('./fixtures');

test.describe('Homepage', () => {
  test.beforeEach(async ({ page, site }) => {
    await page.goto('/');
    await expect(page.locator('#contactForm')).toBeAttached();
  });

  test.afterEach(async ({ site }) => {
    expect(site.pageErrors, 'JavaScript errors on the page').toEqual([]);
    expect(site.missingFiles, 'Files the page tried to load but are missing').toEqual([]);
  });

  test('loads with the right title, phone, email and license number', async ({ page }) => {
    await expect(page).toHaveTitle(/Zach Belman/);
    await expect(page.locator('a[href="tel:+14083728777"]').first()).toBeAttached();
    await expect(page.locator('a[href="mailto:zachbelman@kw.com"]').first()).toBeAttached();
    await expect(page.locator('body')).toContainText('DRE #02165828');
  });

  test('contact form is connected to a real Formspree form', async ({ page }) => {
    const action = await page.locator('#contactForm').getAttribute('action');
    expect(action).toMatch(FORMSPREE);
    expect(action).not.toContain('YOUR_FORM_ID');
  });

  test('contact form submits and shows the thank-you message', async ({ page, site }) => {
    await page.locator('#contact').scrollIntoViewIfNeeded();
    await page.fill('#f-name', 'Test Buyer');
    await page.fill('#f-phone', '(408) 555-0100');
    await page.fill('#f-email', 'test.buyer@example.com');
    await page.selectOption('#f-interest', 'Selling');
    await page.fill('#f-message', 'Automated test, please ignore.');
    await page.click('#submitBtn');

    await expect(page.locator('#thanks')).toBeVisible();
    await expect(page.locator('#thanks')).toContainText('message received');
    expect(site.formPosts).toHaveLength(1);
    const post = site.formPosts[0];
    expect(post.url).toMatch(FORMSPREE);
    expect(site.fieldValue(post, 'name')).toBe('Test Buyer');
    expect(site.fieldValue(post, 'email')).toBe('test.buyer@example.com');
    expect(site.fieldValue(post, 'interested_in')).toBe('Selling');
    expect(await site.analyticsEvents()).toContain('generate_lead');
  });

  test('contact form blocks empty or invalid submissions', async ({ page, site }) => {
    await page.locator('#contact').scrollIntoViewIfNeeded();
    await page.click('#submitBtn');
    await page.fill('#f-name', 'Test');
    await page.fill('#f-email', 'not-an-email');
    await page.click('#submitBtn');
    await page.waitForTimeout(300);
    expect(site.formPosts, 'nothing should be sent').toHaveLength(0);
    await expect(page.locator('#thanks')).toBeHidden();
  });

  test('every "Book a Call" button opens Calendly, and a booking shows a confirmation', async ({ page, site }) => {
    const buttons = page.locator('[data-book]');
    const count = await buttons.count();
    expect(count, 'Book a Call buttons on the page').toBeGreaterThanOrEqual(3);
    let tested = 0;
    for (let i = 0; i < count; i++) {
      const b = buttons.nth(i);
      await b.scrollIntoViewIfNeeded();
      if (!(await b.isVisible())) continue; // some buttons only show on desktop or phone
      await b.click();
      await expect(page.locator('#bookModal')).toHaveClass(/open/);
      expect(await page.locator('#bookFrame').getAttribute('src')).toContain(CALENDLY);
      await page.keyboard.press('Escape');
      await expect(page.locator('#bookModal')).not.toHaveClass(/open/);
      tested++;
    }
    expect(tested, 'visible Book a Call buttons that were clicked').toBeGreaterThanOrEqual(2);

    // Booking confirmation
    await buttons.first().scrollIntoViewIfNeeded();
    await page.locator('[data-book]:visible').first().click();
    await site.simulateCalendlyBooking();
    await expect(page.locator('#bookDone')).toBeVisible();
    await expect(page.locator('#bookDone')).toContainText("You're booked");
    expect(await site.analyticsEvents()).toContain('generate_lead');
  });

  test('every "Get in Touch" style button takes visitors to the contact form', async ({ page }) => {
    test.setTimeout(120_000);
    const ctas = page.locator('[data-cta]');
    const count = await ctas.count();
    expect(count).toBeGreaterThanOrEqual(5);
    let tested = 0;
    for (let i = 0; i < count; i++) {
      const c = ctas.nth(i);
      if (!(await c.isVisible())) continue; // e.g. buttons that only appear in some states
      const interest = await c.getAttribute('data-interest');
      await page.evaluate(() => window.scrollTo(0, 0));
      await c.scrollIntoViewIfNeeded();
      await c.click();
      await expect(page.locator('#contact')).toBeInViewport({ timeout: 5000 });
      await expect(page.locator('#f-name')).toBeFocused({ timeout: 5000 });
      if (interest) await expect(page.locator('#f-interest')).toHaveValue(interest);
      tested++;
    }
    expect(tested, 'visible contact buttons that were clicked').toBeGreaterThanOrEqual(5);
  });

  test('featured YouTube section has at least 3 videos', async ({ page }) => {
    const videos = page.locator('#follow a.yt[href*="youtube.com/watch"]');
    expect(await videos.count()).toBeGreaterThanOrEqual(3);
    for (const v of await videos.all()) {
      await expect(v.locator('img')).toHaveAttribute('src', /.+/);
    }
  });

  test('featured Instagram section has at least 6 posts', async ({ page }) => {
    const posts = page.locator('#follow a.ig[href*="instagram.com/"]');
    expect(await posts.count()).toBeGreaterThanOrEqual(6);
    for (const p of await posts.all()) {
      await expect(p.locator('img')).toHaveAttribute('src', /.+/);
    }
  });

  test('market lookup shows numbers for a city and a ZIP code', async ({ page }) => {
    await page.locator('#market').scrollIntoViewIfNeeded();
    await expect(page.locator('#mPrice')).toHaveText(/^\$[\d.]+[MK]$/);
    await page.fill('#cityInput', '95123');
    await page.press('#cityInput', 'Enter');
    await expect(page.locator('#mCity')).toHaveText('ZIP 95123');
    await expect(page.locator('#mStats')).toBeVisible();
    await expect(page.locator('#mPrice')).toHaveText(/^\$[\d.]+[MK]$/);
    await page.fill('#cityInput', 'Not A Real Place');
    await page.press('#cityInput', 'Enter');
    await expect(page.locator('#mEmpty')).toBeVisible();
  });

  test('animations: numbers count up to the right values when scrolled to', async ({ page }) => {
    const stats = page.locator('#about .stats b');
    await stats.first().scrollIntoViewIfNeeded();
    await expect(stats).toHaveText(['5.0★', '77K', '3,900+'], { timeout: 6000 });
    await page.locator('#mStats').scrollIntoViewIfNeeded();
    await expect(page.locator('#mPrice')).toHaveText(/^\$[1-9][\d.]*[MK]$/, { timeout: 6000 });
    await expect(page.locator('#mDom')).toHaveText(/^[1-9]\d* days$/, { timeout: 6000 });
  });

  test('animations: headline reads normally and the city strip scrolls', async ({ page }) => {
    await expect(page.locator('h1')).toHaveText('Buy, sell and invest in the Bay Area with a local expert.');
    const track = page.locator('.marquee-track');
    const x = () => track.evaluate((e) => new DOMMatrix(getComputedStyle(e).transform).m41);
    const first = await x();
    await expect.poll(x, { timeout: 4000 }).toBeLessThan(first - 5);
    await expect(page.locator('.marquee-group:not([aria-hidden]) li').first()).toHaveText('San Jose');
  });

  test('animations: sold homes, videos and reviews all end up fully visible', async ({ page }) => {
    for (const sel of ['#track .card', '.yt-grid .yt', '.reviews .review', '.ig-grid .ig']) {
      const el = page.locator(sel).first();
      await el.scrollIntoViewIfNeeded();
      await expect.poll(() => el.evaluate((n) => getComputedStyle(n).opacity), { message: sel, timeout: 6000 }).toBe('1');
    }
  });

  test('page fits the screen width (no sideways scrolling)', async ({ page }) => {
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(1);
  });
});

test('visitors who turn off motion see everything right away, with no animation', async ({ browser }) => {
  const ctx = await browser.newContext({ reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  await page.route((u) => u.hostname !== '127.0.0.1', (r) => r.abort());
  await page.goto('/');
  await expect(page.locator('#about .stats b')).toHaveText(['5.0★', '77K', '3,900+']);
  expect(await page.locator('.marquee-track').evaluate((e) => getComputedStyle(e).animationName)).toBe('none');
  expect(await page.locator('#track .card').last().evaluate((n) => getComputedStyle(n).opacity)).toBe('1');
  await ctx.close();
});
