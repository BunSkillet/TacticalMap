const assert = require('assert');
const userManager = require('../server/userManager');

function reset() {
  // clear internal arrays via removing all users
  userManager.getAllUsers().slice().forEach(u => userManager.removeUser(u.id));
}

function testAddAndGetUser() {
  reset();
  const u = userManager.addUser('abc', 'Alice', 'room1');
  assert.strictEqual(u.id, 'abc');
  assert.strictEqual(u.name, 'Alice');
  const fetched = userManager.getUser('abc');
  assert.strictEqual(fetched.id, 'abc');
  assert.strictEqual(fetched.name, 'Alice');
  userManager.removeUser('abc');
}

function testDefaultColor() {
  reset();
  const u = userManager.addUser('user1', 'Bob', 'room1');
  assert.strictEqual(u.color, '#ff0000');
  userManager.removeUser('user1');
}

function testMultipleRed() {
  reset();
  const u1 = userManager.addUser('u1', 'A', 'room1');
  const u2 = userManager.addUser('u2', 'B', 'room1');
  // second user already has red; attempt to change color back to red explicitly
  const r = userManager.changeUserColor('u2', '#ff0000');
  assert.ok(r.success);
  assert.strictEqual(userManager.getUser('u1').color, '#ff0000');
  assert.strictEqual(userManager.getUser('u2').color, '#ff0000');
  userManager.removeUser('u1');
  userManager.removeUser('u2');
}

function testChangeColor() {
  reset();
  userManager.addUser('abc', 'C', 'room1');
  const result = userManager.changeUserColor('abc', 'blue');
  assert.ok(result.success);
  assert.strictEqual(result.color, 'blue');
  const u = userManager.getUser('abc');
  assert.strictEqual(u.color, 'blue');
  userManager.removeUser('abc');
}

function testUniqueColorSelection() {
  reset();
  userManager.addUser('a', 'A', 'room1');
  userManager.addUser('b', 'B', 'room1');
  const r1 = userManager.changeUserColor('a', 'green');
  assert.ok(r1.success);
  const r2 = userManager.changeUserColor('b', 'green');
  assert.ok(!r2.success);
  userManager.removeUser('a');
  userManager.removeUser('b');
}

function testColorIndependenceAcrossRooms() {
  reset();
  userManager.addUser('r1a', 'A', 'room1');
  userManager.addUser('r2a', 'B', 'room2');
  const res1 = userManager.changeUserColor('r1a', 'orange');
  const res2 = userManager.changeUserColor('r2a', 'orange');
  assert.ok(res1.success);
  assert.ok(res2.success); // same colour allowed in different rooms
  userManager.removeUser('r1a');
  userManager.removeUser('r2a');
}

function testRemoveUser() {
  reset();
  userManager.addUser('abc', 'Z', 'room1');
  const removed = userManager.removeUser('abc');
  assert.ok(removed);
  assert.strictEqual(userManager.getUser('abc'), null);
}

function run() {
  testAddAndGetUser();
  testDefaultColor();
  testMultipleRed();
  testChangeColor();
  testUniqueColorSelection();
  testColorIndependenceAcrossRooms();
  testRemoveUser();
  console.log('All tests passed');
}

run();
