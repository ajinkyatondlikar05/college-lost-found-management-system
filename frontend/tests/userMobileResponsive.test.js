import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendRoot = path.resolve(__dirname, '..');

describe('User Mobile Layout & Collapsible Filter Drawer Verification', () => {
  const dashboardJsxPath = path.join(frontendRoot, 'src', 'pages', 'Dashboard.jsx');
  const dashboardCssPath = path.join(frontendRoot, 'src', 'pages', 'Dashboard.css');

  const jsxContent = fs.readFileSync(dashboardJsxPath, 'utf-8');
  const cssContent = fs.readFileSync(dashboardCssPath, 'utf-8');

  it('Dashboard.jsx contains mobile navbar elements: brand logo, + Report Item button, user profile menu', () => {
    assert.ok(jsxContent.includes('ud-navbar'), 'ud-navbar header must be present');
    assert.ok(jsxContent.includes('ud-brand'), 'Logo container must be present');
    assert.ok(jsxContent.includes('ud-btn-report-item'), 'Report Item button must be present');
    assert.ok(jsxContent.includes('+ Report Item'), '+ Report Item text must be present');
    assert.ok(jsxContent.includes('ud-user-pill-btn'), 'User profile pill button must be present');
    assert.ok(jsxContent.includes('ud-user-firstname'), 'User firstname must be present');
  });

  it('Dashboard.jsx implements mobile filter drawer state, backdrop, and trigger button', () => {
    assert.ok(jsxContent.includes('mobileFiltersOpen'), 'mobileFiltersOpen state must be declared');
    assert.ok(jsxContent.includes('ud-filter-backdrop'), 'Filter backdrop element must be present');
    assert.ok(jsxContent.includes('ud-mobile-filter-trigger'), 'Mobile [ Filters ] trigger button must be present');
    assert.ok(jsxContent.includes('ud-filter-close-btn'), 'Filter drawer close X button must be present');
    assert.ok(jsxContent.includes('mobile-drawer-open'), 'Drawer open class modifier must be present');
  });

  it('Dashboard.jsx preserves all 5 filter groups: Category, Location, Date Range (From/To), Sort By, and Clear', () => {
    assert.ok(jsxContent.includes('Category'), 'Category filter must be present');
    assert.ok(jsxContent.includes('selectedCategory'), 'Category state binding must be present');
    assert.ok(jsxContent.includes('Location'), 'Location filter must be present');
    assert.ok(jsxContent.includes('locationFilter'), 'Location state binding must be present');
    assert.ok(jsxContent.includes('Date Range'), 'Date range label must be present');
    assert.ok(jsxContent.includes('fromDate'), 'From date input must be present');
    assert.ok(jsxContent.includes('toDate'), 'To date input must be present');
    assert.ok(jsxContent.includes('Sort By'), 'Sort By dropdown must be present');
    assert.ok(jsxContent.includes('sortBy'), 'Sort By state binding must be present');
    assert.ok(jsxContent.includes('handleClearFilters'), 'Clear filters handler must be present');
  });

  it('Dashboard.css hides mobile-only elements by default on desktop', () => {
    assert.ok(cssContent.includes('.ud-filter-close-btn {\n  display: none;\n}'), 'Close button hidden on desktop');
    assert.ok(cssContent.includes('.ud-mobile-filter-trigger {\n  display: none;\n}'), 'Mobile filter trigger hidden on desktop');
    assert.ok(cssContent.includes('.ud-filter-backdrop {\n  display: none;\n}'), 'Backdrop hidden on desktop');
  });

  it('Dashboard.css includes mobile media query (@media max-width: 768px) with all required responsive rules', () => {
    assert.ok(cssContent.includes('@media (max-width: 768px)'), '@media (max-width: 768px) must be present');
    assert.ok(cssContent.includes('.ud-filter-sidebar.mobile-drawer-open'), 'mobile-drawer-open drawer style must be defined');
    assert.ok(cssContent.includes('.ud-mobile-filter-trigger'), 'Mobile filter trigger styling must be defined');
    assert.ok(cssContent.includes('.ud-navbar-container'), 'Compact mobile navbar container must be defined');
    assert.ok(cssContent.includes('.ud-btn-report-item'), 'Compact mobile report button must be defined');
    assert.ok(cssContent.includes('.ud-user-pill-btn'), 'Compact mobile user pill must be defined');
    assert.ok(cssContent.includes('overflow-x: hidden'), 'Page overflow protection must be defined');
  });
});
