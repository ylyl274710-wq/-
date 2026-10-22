import { chromium } from '../.verification/node_modules/playwright/index.mjs';
import assert from 'node:assert/strict';

const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
await context.addInitScript(() => {
  window.__activeUrls = new Set();
  const create = URL.createObjectURL.bind(URL), revoke = URL.revokeObjectURL.bind(URL);
  URL.createObjectURL = blob => { const url = create(blob); window.__activeUrls.add(url); return url; };
  URL.revokeObjectURL = url => { window.__activeUrls.delete(url); revoke(url); };
});
const page = await context.newPage();
const errors = [];
page.on('pageerror', error => errors.push(error.message));
page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
const results = [];
async function record(name, action) { await action(); results.push(name); console.log(`PASS ${name}`); }
async function moves() { return Number(await page.getByTestId('moves').textContent()); }
async function clickTile(index) { await page.locator(`[data-position="${index}"]`).click(); }
async function point(index) {
  const box = await page.locator(`[data-position="${index}"]`).boundingBox();
  assert.ok(box); return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}
async function drag(from, to) {
  const a = await point(from), b = await point(to);
  await page.mouse.move(a.x, a.y); await page.mouse.down();
  await page.mouse.move(b.x, b.y, { steps: 8 }); await page.mouse.up();
}
try {
  await page.goto('http://127.0.0.1:5173/');
  await record('1440px 首页布局、初始按钮禁用', async () => {
    assert.equal(await page.getByRole('button', { name: '开始拼图' }).isDisabled(), true);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.screenshot({ path: '.verification/home-desktop.png', fullPage: true });
  });
  await page.getByRole('button', { name: /试试示例图/ }).click();
  await page.getByRole('button', { name: '开始拼图' }).click();
  await record('9块开局未完成，首次交换前计时为零', async () => {
    assert.equal(await page.locator('[data-position]').count(), 9);
    const tiles = await page.locator('[data-position]').evaluateAll(nodes => nodes.map(n => Number(n.dataset.correct)));
    assert.equal(tiles.every((v, i) => v === i), false);
    await page.waitForTimeout(1100);
    assert.equal(await page.getByTestId('timer').textContent(), '00:00');
    await page.screenshot({ path: '.verification/game-desktop.png', fullPage: true });
  });
  await record('点击选中、取消、两块交换', async () => {
    await clickTile(0); assert.equal(await page.locator('[data-position="0"]').getAttribute('aria-pressed'), 'true');
    await clickTile(0); assert.equal(await moves(), 0);
    await clickTile(0); await clickTile(1); assert.equal(await moves(), 1);
    await page.waitForTimeout(1100); assert.notEqual(await page.getByTestId('timer').textContent(), '00:00');
  });
  await record('Pointer拖动交换、3px移动按点击、拖出棋盘取消', async () => {
    await drag(0, 1); assert.equal(await moves(), 2);
    const p = await point(2); await page.mouse.move(p.x, p.y); await page.mouse.down();
    await page.mouse.move(p.x + 3, p.y); await page.mouse.up();
    assert.equal(await page.locator('[data-position="2"]').getAttribute('aria-pressed'), 'true');
    await clickTile(2); assert.equal(await moves(), 2);
    await page.mouse.move(p.x, p.y); await page.mouse.down(); await page.mouse.move(10, 10, { steps: 8 }); await page.mouse.up();
    assert.equal(await moves(), 2); assert.equal(await page.locator('.drag-ghost').count(), 0);
  });
  await record('按住原图预览，移出按钮松开仍恢复', async () => {
    const button = page.getByRole('button', { name: '按住预览原图' });
    const box = await button.boundingBox(); assert.ok(box);
    await page.mouse.move(box.x + 20, box.y + 20); await page.mouse.down();
    assert.equal(await page.locator('.board-preview').getAttribute('aria-hidden'), 'false');
    await page.mouse.move(10, 10); await page.mouse.up();
    assert.equal(await page.locator('.board-preview').getAttribute('aria-hidden'), 'true');
  });
  await page.getByRole('button', { name: '重新打乱' }).click();
  await record('重新打乱重置步数与时间', async () => {
    assert.equal(await moves(), 0); assert.equal(await page.getByTestId('timer').textContent(), '00:00');
  });
  await record('完整通关、合并动画、结果弹窗、焦点、再来一局', async () => {
    for (let i = 0; i < 9; i++) {
      const j = Number(await page.locator(`[data-correct="${i}"]`).getAttribute('data-position'));
      if (i !== j) { await clickTile(i); await clickTile(j); }
    }
    const dialog = page.getByRole('dialog'); await dialog.waitFor();
    assert.equal(await page.locator('.board-shell.is-completed').count(), 1);
    assert.equal(await dialog.getByRole('heading', { name: '美好，完整了。' }).count(), 1);
    const time = await page.getByTestId('timer').textContent(); await page.waitForTimeout(1100);
    assert.equal(await page.getByTestId('timer').textContent(), time);
    for (let i = 0; i < 6; i++) await page.keyboard.press('Tab');
    assert.equal(await page.evaluate(() => !!document.activeElement?.closest('dialog')), true);
    await page.screenshot({ path: '.verification/result-desktop.png', fullPage: true });
    await dialog.getByRole('button', { name: '再来一局' }).click();
    assert.equal(await moves(), 0); assert.equal(await page.getByRole('dialog').count(), 0);
  });
  await record('4×4 / 5×5难度', async () => {
    for (const n of [4, 5]) {
      await page.getByRole('button', { name: '换一张图' }).click();
      await page.getByRole('button', { name: new RegExp(`${n} × ${n}`) }).click();
      await page.getByRole('button', { name: '开始拼图' }).click();
      assert.equal(await page.locator('[data-position]').count(), n * n);
    }
  });
  await page.getByRole('button', { name: '换一张图' }).click();
  await record('非法类型、超过10MB、损坏图片均Toast', async () => {
    const input = page.locator('input[type=file]');
    await input.setInputFiles({ name: 'bad.gif', mimeType: 'image/gif', buffer: Buffer.from('gif') });
    await page.getByRole('status').filter({ hasText: '请选择 JPG' }).waitFor();
    await input.setInputFiles({ name: 'big.png', mimeType: 'image/png', buffer: Buffer.alloc(10 * 1024 * 1024 + 1) });
    await page.getByRole('status').filter({ hasText: '图片超过 10MB' }).waitFor();
    await input.setInputFiles({ name: 'broken.png', mimeType: 'image/png', buffer: Buffer.from('broken') });
    await page.getByRole('status').filter({ hasText: '无法读取' }).waitFor();
  });
  await record('JPG / PNG / WebP本地解码，横图居中裁剪', async () => {
    for (const [ext, mime] of [['jpg', 'image/jpeg'], ['png', 'image/png'], ['webp', 'image/webp']]) {
      const data = await page.evaluate(type => {
        const c = document.createElement('canvas'); c.width = 400; c.height = 200;
        const ctx = c.getContext('2d'); ctx.fillStyle = 'red'; ctx.fillRect(0, 0, 400, 200);
        ctx.fillStyle = '#00ff00'; ctx.fillRect(100, 0, 200, 200);
        ctx.fillStyle = 'blue'; ctx.fillRect(300, 0, 100, 200); return c.toDataURL(type).split(',')[1];
      }, mime);
      await page.locator('input[type=file]').setInputFiles({ name: `crop.${ext}`, mimeType: mime, buffer: Buffer.from(data, 'base64') });
      await page.getByText(`已就绪 · crop.${ext}`).waitFor();
      const pixels = await page.locator('.art-frame > img').evaluate(async img => {
        await img.decode(); const c = document.createElement('canvas'); c.width = c.height = 200;
        const ctx = c.getContext('2d'); ctx.drawImage(img, 0, 0);
        return { w: img.naturalWidth, h: img.naturalHeight, p: Array.from(ctx.getImageData(10, 100, 1, 1).data) };
      });
      assert.equal(pixels.w, 200); assert.equal(pixels.h, 200); assert.ok(pixels.p[1] > 240);
    }
  });
  await record('原生拖入图片', async () => {
    await page.locator('.upload-zone').evaluate(zone => {
      const canvas = document.createElement('canvas'); canvas.width = canvas.height = 100;
      const data = atob(canvas.toDataURL('image/png').split(',')[1]);
      const bytes = Uint8Array.from(data, c => c.charCodeAt(0));
      const transfer = new DataTransfer(); transfer.items.add(new File([bytes], 'dropped.png', { type: 'image/png' }));
      zone.dispatchEvent(new DragEvent('dragenter', { bubbles: true, cancelable: true, dataTransfer: transfer }));
      zone.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: transfer }));
    });
    await page.getByText('已就绪 · dropped.png').waitFor();
  });
  await record('375px首页与5×5游戏无横向溢出', async () => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.screenshot({ path: '.verification/home-mobile.png', fullPage: true });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.getByRole('button', { name: /试试示例图/ }).click();
    await page.getByRole('button', { name: '开始拼图' }).click();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await drag(0, 1); assert.equal(await moves(), 1);
    await page.screenshot({ path: '.verification/game-mobile.png', fullPage: true });
  });
  await record('更换图片后旧ObjectURL已释放，仅保留当前图片', async () => {
    assert.equal(await page.evaluate(() => window.__activeUrls.size), 1);
  });
  await record('触屏Pointer点击、拖动、系统取消与键盘操作', async () => {
    const mobile = await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true });
    const touchPage = await mobile.newPage();
    touchPage.on('pageerror', error => errors.push(error.message));
    await touchPage.goto('http://127.0.0.1:5173/');
    await touchPage.getByRole('button', { name: /试试示例图/ }).tap();
    await touchPage.getByRole('button', { name: '开始拼图' }).tap();
    const aBox = await touchPage.locator('[data-position="0"]').boundingBox();
    const bBox = await touchPage.locator('[data-position="1"]').boundingBox();
    const a = { x: aBox.x + aBox.width / 2, y: aBox.y + aBox.height / 2 };
    const b = { x: bBox.x + bBox.width / 2, y: bBox.y + bBox.height / 2 };
    const cdp = await mobile.newCDPSession(touchPage);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [a] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    assert.equal(await touchPage.locator('[data-position="0"]').getAttribute('aria-pressed'), 'true');
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [a] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    assert.equal(await touchPage.locator('[data-position="0"]').getAttribute('aria-pressed'), 'false');
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [a] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [b] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    assert.equal(Number(await touchPage.getByTestId('moves').textContent()), 1);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [a] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [b] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
    assert.equal(await touchPage.locator('.drag-ghost').count(), 0);
    assert.equal(Number(await touchPage.getByTestId('moves').textContent()), 1);
    await touchPage.locator('[data-position="0"]').focus();
    await touchPage.keyboard.press('Space'); await touchPage.keyboard.press('ArrowRight'); await touchPage.keyboard.press('Space');
    assert.equal(Number(await touchPage.getByTestId('moves').textContent()), 2);
    const previewButton = touchPage.getByRole('button', { name: '按住预览原图' });
    await previewButton.focus(); await touchPage.keyboard.down('Space');
    assert.equal(await touchPage.locator('.board-preview').getAttribute('aria-hidden'), 'false');
    await touchPage.keyboard.up('Space');
    assert.equal(await touchPage.locator('.board-preview').getAttribute('aria-hidden'), 'true');
    await mobile.close();
  });
  await record('无JavaScript或控制台错误', async () => assert.deepEqual(errors, []));
  console.log(JSON.stringify({ passed: results.length, results }, null, 2));
} finally { await browser.close(); }
