const { createServer } = require('node:http');
const { readFileSync, existsSync } = require('node:fs');
const { extname, join, normalize } = require('node:path');
const { chromium } = require('playwright');

const docsRoot = process.cwd();
const distRoot = join(docsRoot, 'dist');
const host = '127.0.0.1';
const port = 4175;
const configuredBasePath = process.env.NIKO_DOCS_BASE_PATH ?? '/';
const normalizedBasePath = configuredBasePath === '/' ? '' : `/${configuredBasePath.replace(/^\/+|\/+$/g, '')}`;
const baseUrl = `http://${host}:${port}${normalizedBasePath || ''}/`;

const pinnedDocsKey = 'niko-docs:pinned-docs';
const pinnedGroupsCollapsedKey = 'niko-docs:pinned-groups-collapsed';
const pinnedSeed = [
  { id: 'craft-analysis', path: '/writing/craft-analysis', bucket: 'writing' },
  { id: 'workflow-api', path: '/api/workflow-api', bucket: 'api' },
  { id: 'worldview-extract', path: '/worldview/worldview-extract', bucket: 'canon' },
];

const contentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

function ensureDistExists() {
  if (!existsSync(join(distRoot, 'index.html'))) {
    throw new Error('缺少 docs-site/dist/index.html，请先运行 npm run build。');
  }
}

function createStaticServer() {
  return createServer((request, response) => {
    const requestPath = request.url ? request.url.split('?')[0] : '/';
    const strippedPath = normalizedBasePath && requestPath.startsWith(normalizedBasePath)
      ? requestPath.slice(normalizedBasePath.length) || '/'
      : requestPath;
    const safePath = normalize(strippedPath || '/').replace(/^(\.\.[/\\])+/, '');
    let filePath = join(distRoot, safePath === '/' ? 'index.html' : safePath);

    if (!existsSync(filePath) || (existsSync(filePath) && extname(filePath) === '')) {
      filePath = join(distRoot, 'index.html');
    }

    try {
      const body = readFileSync(filePath);
      response.statusCode = 200;
      response.setHeader('Content-Type', contentTypes[extname(filePath)] ?? 'text/plain; charset=utf-8');
      response.end(body);
    } catch (error) {
      response.statusCode = 404;
      response.end(String(error));
    }
  });
}

async function openSearchPanel(page, mode) {
  const inputSelector = `[data-doc-search-input="${mode === 'mobile' ? 'mobile' : 'desktop'}"]`;

  if (mode === 'mobile') {
    const isVisible = await page.evaluate((selector) => {
      const element = document.querySelector(selector);
      if (!(element instanceof HTMLElement)) {
        return false;
      }

      const rect = element.getBoundingClientRect();
      return rect.width > 0 && rect.x >= 0;
    }, inputSelector);

    if (!isVisible) {
      await page.getByRole('button', { name: 'Toggle sidebar' }).click();
      await page.waitForFunction((selector) => {
        const element = document.querySelector(selector);
        if (!(element instanceof HTMLElement)) {
          return false;
        }

        const rect = element.getBoundingClientRect();
        return rect.width > 0 && rect.x >= 0;
      }, inputSelector);
    }
  } else {
    await page.locator(inputSelector).waitFor({ state: 'visible' });
  }

  await page.locator(inputSelector).click();
  await page.getByText('固定入口 / 收藏入口').waitFor({ state: 'visible' });
}

async function verifyPinnedSections(page) {
  await page.getByText('写作用 · 1 / 6').waitFor({ state: 'visible' });
  await page.getByText('API 用 · 1 / 6').waitFor({ state: 'visible' });
  await page.getByText('设定用 · 1 / 6').waitFor({ state: 'visible' });
  await page.getByRole('button', { name: '折叠 写作用' }).click();
  await page.getByText('已折叠，当前共 1 条固定入口。').waitFor({ state: 'visible' });
  const storedAfterCollapse = await page.evaluate((key) => window.localStorage.getItem(key), pinnedGroupsCollapsedKey);
  if (storedAfterCollapse !== '["writing"]') {
    throw new Error(`折叠状态未写入 localStorage，实际值：${storedAfterCollapse}`);
  }
}

async function verifyPersistenceAfterReload(page, mode) {
  await page.reload({ waitUntil: 'networkidle' });
  await openSearchPanel(page, mode);
  await page.getByRole('button', { name: '展开 写作用' }).waitFor({ state: 'visible' });
  const storedAfterReload = await page.evaluate((key) => window.localStorage.getItem(key), pinnedGroupsCollapsedKey);
  if (storedAfterReload !== '["writing"]') {
    throw new Error(`刷新后折叠状态丢失，实际值：${storedAfterReload}`);
  }
}

async function verifyPinnedManagement(page, mode) {
  await openSearchPanel(page, mode);
  await page.locator(`[data-doc-search-input="${mode === 'mobile' ? 'mobile' : 'desktop'}"]`).fill('workflow');
  await page.locator('[data-search-option-type="result"][data-search-doc-id="workflow-api"]').waitFor({ state: 'visible' });
  await page.getByRole('button', { name: '取消收藏 Workflow API' }).click();
  await page.getByRole('button', { name: '收藏 Workflow API' }).waitFor({ state: 'visible' });
  await page.getByRole('button', { name: '收藏 Workflow API' }).click();
  await page.getByRole('button', { name: '取消收藏 Workflow API' }).waitFor({ state: 'visible' });
  await page.locator(`[data-doc-search-input="${mode === 'mobile' ? 'mobile' : 'desktop'}"]`).fill('');
  await page.getByText('固定入口 / 收藏入口').waitFor({ state: 'visible' });
  const expandWritingButton = page.getByRole('button', { name: '展开 写作用' });
  if (await expandWritingButton.isVisible().catch(() => false)) {
    await expandWritingButton.click();
  }
  await page.locator('select[aria-label="调整分组 Workflow API"]').waitFor({ state: 'visible' });

  await page.locator('select[aria-label="调整分组 Workflow API"]').selectOption('writing');
  await page.locator('[data-pinned-group="writing"] [data-pinned-item="workflow-api"]').waitFor({ state: 'visible' });
  const writingItems = page.locator('[data-pinned-group="writing"] [data-pinned-item]');
  const firstWritingCard = await writingItems.first().getAttribute('data-pinned-item');
  if (firstWritingCard !== 'workflow-api') {
    throw new Error(`改组后未进入写作用首位，实际首项：${firstWritingCard}`);
  }

  await page.getByRole('button', { name: '下移 Workflow API' }).click();
  const firstAfterDown = await writingItems.first().getAttribute('data-pinned-item');
  if (firstAfterDown !== 'craft-analysis') {
    throw new Error(`下移后排序未生效，当前首项：${firstAfterDown}`);
  }

  await page.getByRole('button', { name: '置顶 Workflow API' }).click();
  const topAfterReorder = await writingItems.first().getAttribute('data-pinned-item');
  if (topAfterReorder !== 'workflow-api') {
    throw new Error(`置顶后排序未恢复，当前首项：${topAfterReorder}`);
  }
}

async function verifyKeyboardNavigation(page, mode) {
  await page.locator(`[data-doc-search-input="${mode === 'mobile' ? 'mobile' : 'desktop'}"]`).fill('workflow');
  await page.locator(`#doc-search-panel-${mode} > div`).first().waitFor({ state: 'visible' });
  await page.locator('[data-search-option-type="result"][data-search-active="true"]').waitFor({ state: 'visible' });
  await page.keyboard.press('Enter');
  await page.waitForURL('**/api/workflow-api');
  const recentQueries = await page.evaluate(() => window.localStorage.getItem('niko-docs:recent-queries'));
  if (!recentQueries || !recentQueries.includes('workflow')) {
    throw new Error(`键盘打开后未记录最近搜索，实际值：${recentQueries}`);
  }
}

async function verifyShortcutSelection(page) {
  await page.goto(baseUrl, { waitUntil: 'networkidle' });
  await page.locator('[data-doc-search-input="desktop"]').fill('workflow');
  await page.keyboard.press(process.platform === 'darwin' ? 'Meta+K' : 'Control+K');
  const selectedText = await page.locator('[data-doc-search-input="desktop"]').evaluate((input) => {
    if (!(input instanceof HTMLInputElement)) {
      return '';
    }
    return input.value.slice(input.selectionStart ?? 0, input.selectionEnd ?? 0);
  });

  if (selectedText !== 'workflow') {
    throw new Error(`Ctrl/Cmd+K 后未选中文本，实际选中：${selectedText}`);
  }
}

async function verifyEmptyStateFallback(page, mode) {
  await openSearchPanel(page, mode);
  await page.locator(`[data-doc-search-input="${mode === 'mobile' ? 'mobile' : 'desktop'}"]`).fill('不存在的调用问题');
  await page.getByRole('listbox', { name: '空结果推荐跳转' }).waitFor({ state: 'visible' });
  await page.locator('[data-search-option-type="fallback"][data-search-active="true"]').waitFor({ state: 'visible' });
  await page.keyboard.press('Enter');
  await page.waitForURL('**/api/workflow-api');
}

async function verifyViewport(browser, name, viewport) {
  const page = await browser.newPage({ viewport });
  await page.addInitScript(
    ({ seed, docsKey, collapsedKey }) => {
      if (!window.localStorage.getItem(docsKey)) {
        window.localStorage.setItem(docsKey, JSON.stringify(seed));
      }
      if (window.localStorage.getItem(collapsedKey) === null) {
        window.localStorage.setItem(collapsedKey, JSON.stringify([]));
      }
      window.localStorage.removeItem('niko-docs:recent-queries');
      window.localStorage.removeItem('niko-docs:recent-docs');
    },
    {
      seed: pinnedSeed,
      docsKey: pinnedDocsKey,
      collapsedKey: pinnedGroupsCollapsedKey,
    },
  );

  await page.goto(baseUrl, { waitUntil: 'networkidle' });
  await openSearchPanel(page, name);
  await verifyPinnedSections(page);
  await verifyPersistenceAfterReload(page, name);
  await verifyPinnedManagement(page, name);
  await verifyKeyboardNavigation(page, name);
  await page.goto(baseUrl, { waitUntil: 'networkidle' });
  await verifyEmptyStateFallback(page, name);
  await page.close();
}

async function main() {
  ensureDistExists();
  const server = createStaticServer();

  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => resolve());
  });

  const browser = await chromium.launch({ headless: true });
  try {
    await verifyViewport(browser, 'desktop', { width: 1440, height: 960 });
    await verifyViewport(browser, 'mobile', { width: 390, height: 844 });
    const shortcutPage = await browser.newPage({ viewport: { width: 1440, height: 960 } });
    try {
      await verifyShortcutSelection(shortcutPage);
    } finally {
      await shortcutPage.close();
    }
    console.log('SearchBox regression passed.');
  } finally {
    await browser.close();
    await new Promise((resolve) => server.close(() => resolve()));
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
