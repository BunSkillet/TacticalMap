const assert = require('assert');
const userManager = require('../server/userManager');

function reset() {
  // clear internal arrays via removing all users
  userManager.getAllUsers().slice().forEach(u => userManager.removeUser(u.id));
}

function testAddAndGetUser() {
  reset();
  const u = userManager.addUser('abc');
  assert.strictEqual(u.id, 'abc');
  const fetched = userManager.getUser('abc');
  assert.strictEqual(fetched.id, 'abc');
  userManager.removeUser('abc');
}

function testChangeColor() {
  reset();
  userManager.addUser('abc');
  const result = userManager.changeUserColor('abc', 'blue');
  assert.ok(result.success);
  assert.strictEqual(result.color, 'blue');
  const u = userManager.getUser('abc');
  assert.strictEqual(u.color, 'blue');
  userManager.removeUser('abc');
}

function testUniqueColorSelection() {
  reset();
  userManager.addUser('a');
  userManager.addUser('b');
  const r1 = userManager.changeUserColor('a', 'green');
  assert.ok(r1.success);
  const r2 = userManager.changeUserColor('b', 'green');
  assert.ok(!r2.success);
  userManager.removeUser('a');
  userManager.removeUser('b');
}

function testRemoveUser() {
  reset();
  userManager.addUser('abc');
  const removed = userManager.removeUser('abc');
  assert.ok(removed);
  assert.strictEqual(userManager.getUser('abc'), null);
}

function run() {
  testAddAndGetUser();
  testChangeColor();
  testUniqueColorSelection();
  testRemoveUser();
  console.log('All tests passed');
}

run();
