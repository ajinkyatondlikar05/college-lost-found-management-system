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

  it('portal selector is configured at root route and logout flows redirect to it', () => {
    const appPath = path.join(frontendRoot, 'src', 'App.jsx');
    const appContent = fs.readFileSync(appPath, 'utf-8');
    assert.ok(appContent.includes('<Route path="/" element={<Home />} />'), 'Home must be mounted at /');

    const homePath = path.join(frontendRoot, 'src', 'pages', 'Home.jsx');
    const homeContent = fs.readFileSync(homePath, 'utf-8');
    assert.ok(
      homeContent.includes("Parshvanath Charitable Trust's") &&
      homeContent.includes("A. P. SHAH INSTITUTE OF TECHNOLOGY") &&
      homeContent.includes("/apsit-logo.png"),
      'Home page must display the institute logo and top header'
    );
    assert.ok(homeContent.includes('Welcome to Portal'), 'Home page must have Welcome to Portal title');
    assert.ok(homeContent.includes('Admin Portal'), 'Home page must have Admin Portal option');
    assert.ok(homeContent.includes('User Portal'), 'Home page must have User Portal option');

    const navbarPath = path.join(frontendRoot, 'src', 'components', 'Navbar.jsx');
    const navbarContent = fs.readFileSync(navbarPath, 'utf-8');
    assert.ok(navbarContent.includes("navigate('/', { replace: true })"), 'Navbar logout must navigate to / with replace');

    const dashboardPath = path.join(frontendRoot, 'src', 'pages', 'Dashboard.jsx');
    const dashboardContent = fs.readFileSync(dashboardPath, 'utf-8');
    assert.ok(dashboardContent.includes("navigate('/', { replace: true })"), 'Dashboard logout must navigate to / with replace');

    const adminDashboardPath = path.join(frontendRoot, 'src', 'pages', 'AdminDashboard.jsx');
    const adminDashboardContent = fs.readFileSync(adminDashboardPath, 'utf-8');
    assert.ok(adminDashboardContent.includes("navigate('/', { replace: true })"), 'AdminDashboard logout must navigate to / with replace');

    const authContextPath = path.join(frontendRoot, 'src', 'context', 'AuthContext.jsx');
    const authContextContent = fs.readFileSync(authContextPath, 'utf-8');
    assert.ok(authContextContent.includes("localStorage.removeItem('token')"), 'AuthContext must remove token on logout');
    assert.ok(authContextContent.includes("localStorage.clear()"), 'AuthContext must clear localStorage on logout');
    assert.ok(authContextContent.includes("sessionStorage.clear()"), 'AuthContext must clear sessionStorage on logout');
    assert.ok(authContextContent.includes("isLoggingOut"), 'AuthContext must track isLoggingOut state');

    const privateRoutePath = path.join(frontendRoot, 'src', 'components', 'PrivateRoute.jsx');
    const privateRouteContent = fs.readFileSync(privateRoutePath, 'utf-8');
    assert.ok(
      privateRouteContent.includes('if (isLoggingOut) return <Navigate to="/" replace />'),
      'PrivateRoute and AdminRoute must redirect directly to / during logout without intermediate login screen'
    );
  });
});
