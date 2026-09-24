const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

test('storefront exposes buy-now flow and admin has new order notifications', () => {
  const script = fs.readFileSync(path.join(__dirname, '../frontend/script.js'), 'utf8');
  const adminScript = fs.readFileSync(path.join(__dirname, '../frontend/admin.js'), 'utf8');
  const adminHtml = fs.readFileSync(path.join(__dirname, '../frontend/admin.html'), 'utf8');

  assert.match(script, /function buyNow|Order now/i, 'Buy-now action is missing from storefront logic.');
  assert.match(adminHtml, /id="order-notify"/i, 'Admin page is missing a notification area.');
  assert.match(adminScript, /new Notification|Notification\.requestPermission|lastOrderId|loadOrders\(\)/i, 'Admin notification logic is missing.');
});

test('backend keeps database and admin credentials configurable', () => {
  const server = fs.readFileSync(path.join(__dirname, '../backend/server.js'), 'utf8');
  const adminScript = fs.readFileSync(path.join(__dirname, '../frontend/admin.js'), 'utf8');

  assert.match(server, /process\.env\.MONGODB_URI/);
  assert.match(server, /process\.env\.ADMIN_USERNAME/);
  assert.match(server, /process\.env\.ADMIN_PASSWORD/);
  assert.match(server, /requireAdmin/);
  assert.match(adminScript, /sessionStorage\.setItem\('umeed-admin-token'/);
  assert.match(adminScript, /Authorization: `Bearer \$\{adminToken\}`/);
});
