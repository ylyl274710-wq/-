import { chromium } from '../.verification/node_modules/playwright/index.mjs';
import assert from 'node:assert/strict';

const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await context.newPage();
const errors = [];
const requests = [];
let expectedNetworkFailure = false;
page.on('pageerror', error => errors.push(error.message));
page.on('console', message => { if (message.type() === 'error' && !expectedNetworkFailure) errors.push(message.text()); });
page.on('request', request => requests.push({ url: request.url(), method: request.method() }));
const storageKey = 'piece-by-piece:campaign:v1';
const results = [];
async function check(name, run) { await run(); results.push(name); console.log(`PASS ${name}`); }
async function countCompleted() { return page.evaluate(key => JSON.parse(localStorage.getItem(key)).results.length, storageKey); }
async function solve(size) {
  await page.waitForFunction(count => document.querySelectorAll('[data-position]').length === count && !document.querySelector('.board-shell.is-completed'), size ** 2);
  assert.equal(await page.locator('[data-position]').count(), size ** 2);
  for (let i = 0; i < size ** 2; i++) {
    const j = Number(await page.locator(`[data-correct="${i}"]`).getAttribute('data-position'));
    if (i !== j) { await page.locator(`[data-position="${i}"]`).click(); await page.locator(`[data-position="${j}"]`).click(); }
  }
  await page.getByRole('dialog').waitFor();
}
async function enterGallery() { await page.getByRole('button', { name: /去闯关/ }).click(); }
try {
  await page.goto('http://127.0.0.1:5173/');
  await page.screenshot({ path: '.verification/home-campaign-desktop.png', fullPage: true });
  await enterGallery();
  await check('新用户仅第一关解锁，所有高清缩略图正常加载', async () => {
    assert.equal(await page.getByRole('button', { name: '第1关：开始挑战' }).isEnabled(), true);
    for (let i = 2; i <= 6; i++) assert.equal(await page.getByRole('button', { name: `第${i}关：未解锁` }).isDisabled(), true);
    await page.locator('[data-level="6"]').scrollIntoViewIfNeeded();
    await page.waitForFunction(() => [...document.querySelectorAll('.level-art img')].every(img => img.complete && img.naturalWidth === 400));
    await page.screenshot({ path: '.verification/campaign-desktop.png', fullPage: true });
  });
  await check('中途退出不能解锁下一关', async () => {
    await page.getByRole('button', { name: '第1关：开始挑战' }).click();
    await page.locator('[data-position="0"]').click(); await page.locator('[data-position="1"]').click();
    await page.getByRole('button', { name: '返回关卡', exact: true }).click();
    assert.equal(await countCompleted(), 0);
    assert.equal(await page.getByRole('button', { name: '第2关：未解锁' }).isDisabled(), true);
  });
  await page.getByRole('button', { name: '第1关：开始挑战' }).click();
  await solve(3);
  await check('第一关完成保存成绩，弹窗显示进入下一关', async () => {
    assert.equal(await countCompleted(), 1);
    assert.equal(await page.getByRole('dialog').getByRole('button', { name: '进入下一关' }).isEnabled(), true);
    await page.waitForTimeout(350);
    await page.screenshot({ path: '.verification/campaign-result.png', fullPage: true });
  });
  await check('下一关图片加载失败可见提示，并可重试', async () => {
    expectedNetworkFailure = true;
    await page.route('**/levels/great-wave.jpg', route => route.fulfill({ status: 503, body: 'Temporarily unavailable' }));
    await page.getByRole('dialog').getByRole('button', { name: '进入下一关' }).click();
    await page.getByRole('dialog').getByRole('alert').waitFor();
    assert.equal(await countCompleted(), 1);
    await page.unroute('**/levels/great-wave.jpg'); expectedNetworkFailure = false;
    await page.getByRole('dialog').getByRole('button', { name: '进入下一关' }).click();
    await page.getByRole('heading', { name: '神奈川冲浪里', exact: true }).first().waitFor();
    assert.equal(await page.locator('[data-position]').count(), 16);
    assert.equal(Number(await page.getByTestId('moves').textContent()), 0);
  });
  await solve(4);
  await check('刷新恢复已解锁进度及成绩，未通关的后续关卡仍锁定', async () => {
    await page.getByRole('dialog').getByRole('button', { name: '返回关卡', exact: true }).click();
    await page.reload(); await enterGallery();
    assert.equal(await page.getByRole('button', { name: '第2关：再挑战' }).isEnabled(), true);
    assert.equal(await page.getByRole('button', { name: '第3关：开始挑战' }).isEnabled(), true);
    assert.equal(await page.getByRole('button', { name: '第4关：未解锁' }).isDisabled(), true);
    assert.equal(await page.locator('.level-best').count(), 2);
    await page.setViewportSize({ width: 375, height: 812 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.screenshot({ path: '.verification/campaign-mobile.png', fullPage: true });
    await page.setViewportSize({ width: 1440, height: 1000 });
  });
  await page.getByRole('button', { name: '第3关：开始挑战' }).click();
  await check('第三至第六关逐关解出，难度增加到64片，最后一关正确收尾', async () => {
    for (let size = 5; size <= 8; size++) {
      if (size === 8) await page.setViewportSize({ width: 375, height: 812 });
      await solve(size);
      assert.equal(await countCompleted(), size - 2);
      if (size < 8) await page.getByRole('dialog').getByRole('button', { name: '进入下一关' }).click();
      else {
        assert.equal(await page.getByRole('dialog').getByRole('heading', { name: '名画之旅，圆满完成。' }).count(), 1);
        assert.equal(await page.getByRole('dialog').getByRole('button', { name: '进入下一关' }).count(), 0);
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
        await page.waitForTimeout(350);
        await page.screenshot({ path: '.verification/final-level-mobile.png', fullPage: true });
        await page.getByRole('dialog').getByRole('button', { name: '查看我的名画收藏' }).click();
      }
    }
    assert.equal(await page.locator('.level-state.finished').count(), 6);
    assert.equal(await page.locator('.level-card button:disabled').count(), 0);
  });
  await check('完成后重玩第一关，进度保持全通关', async () => {
    await page.getByRole('button', { name: '第1关：再挑战' }).click();
    await page.waitForFunction(() => document.querySelectorAll('[data-position]').length === 9);
    assert.equal(await page.locator('[data-position]').count(), 9);
    assert.equal(await countCompleted(), 6);
    await page.getByRole('button', { name: '返回关卡', exact: true }).click();
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.screenshot({ path: '.verification/collection-complete.png', fullPage: true });
  });
  await check('图源均为本地静态资源，无上传和外部图片请求，无非预期报错', async () => {
    assert.deepEqual(errors, []);
    assert.equal(requests.some(item => item.method === 'POST'), false);
    assert.equal(requests.some(item => /^https?:/.test(item.url) && !item.url.startsWith('http://127.0.0.1:5173/')), false);
  });
  const noStorage = await browser.newContext();
  await noStorage.addInitScript(() => {
    Object.defineProperty(Storage.prototype, 'getItem', { value: () => { throw new DOMException('Blocked', 'SecurityError'); } });
    Object.defineProperty(Storage.prototype, 'setItem', { value: () => { throw new DOMException('Blocked', 'SecurityError'); } });
  });
  const blockedPage = await noStorage.newPage();
  await check('存储被禁用时仍能进入闯关并明确提示进度范围', async () => {
    await blockedPage.goto('http://127.0.0.1:5173/');
    await blockedPage.getByRole('button', { name: /去闯关/ }).click();
    await blockedPage.getByText('浏览器未允许存储，进度仅在本次页面保留').waitFor();
    await blockedPage.getByRole('button', { name: '第1关：开始挑战' }).click();
    await blockedPage.locator('[data-position="0"]').waitFor();
  });
  await noStorage.close();
  console.log(JSON.stringify({ passed: results.length, results }, null, 2));
} finally { await browser.close(); }
