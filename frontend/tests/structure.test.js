import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendRoot = path.resolve(__dirname, '..');

describe('Frontend Structure & Page Integrity', () => {
  it('index.html should have root div and load main entrypoint', () => {
    const indexPath = path.join(frontendRoot, 'index.html');
    assert.ok(fs.existsSync(indexPath), 'index.html must exist');

    const html = fs.readFileSync(indexPath, 'utf-8');
    assert.ok(html.includes('id="root"'), 'index.html must contain #root div');
    assert.ok(html.includes('/src/main.jsx'), 'index.html must reference main entrypoint');
  });

  it('all 11 application pages must be present', () => {
    const requiredPages = [
      'AdminDashboard.jsx',
      'AdminLogin.jsx',
      'Dashboard.jsx',
      'Home.jsx',
      'ItemDetail.jsx',
      'Items.jsx',
      'Login.jsx',
      'MyReports.jsx',
      'Register.jsx',
      'ReportItem.jsx',
      'UserLogin.jsx',
    ];

    const pagesDir = path.join(frontendRoot, 'src', 'pages');
    for (const page of requiredPages) {
      const pagePath = path.join(pagesDir, page);
      assert.ok(fs.existsSync(pagePath), `Page ${page} must exist in src/pages`);
    }
  });

  it('all core components and auth context must be present', () => {
    const requiredComponents = [
      'Navbar.jsx',
      'Footer.jsx',
      'ItemCard.jsx',
      'PrivateRoute.jsx',
      'LampAuth.jsx',
      'VismeLoginForm.jsx',
    ];

    const componentsDir = path.join(frontendRoot, 'src', 'components');
    for (const comp of requiredComponents) {
      const compPath = path.join(componentsDir, comp);
      assert.ok(fs.existsSync(compPath), `Component ${comp} must exist in src/components`);
    }

    const authContextPath = path.join(frontendRoot, 'src', 'context', 'AuthContext.jsx');
    assert.ok(fs.existsSync(authContextPath), 'AuthContext.jsx must exist');
  });
});
