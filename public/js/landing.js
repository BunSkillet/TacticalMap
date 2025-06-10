const urlParams = new URLSearchParams(window.location.search);
if (urlParams.get('invalidRoom') === '1') {
  alert('Invalid room code');
}
const nameInput = document.getElementById('name');
function getName() {
  return nameInput.value.trim();
}
document.getElementById('host-btn').addEventListener('click', async () => {
  const name = getName();
  if (!name) return alert('Please enter your name');
  try {
    const resp = await fetch('/host', { method: 'POST' });
    const data = await resp.json();
    const code = encodeURIComponent(data.code);
    window.location.href = `board.html?name=${encodeURIComponent(name)}&room=${code}&host=1`;
  } catch (err) {
    alert('Failed to create room');
  }
});
document.getElementById('join-btn').addEventListener('click', () => {
  const name = getName();
  if (!name) return alert('Please enter your name');
  const room = encodeURIComponent(document.getElementById('room').value.trim());
  window.location.href = `board.html?name=${encodeURIComponent(name)}&room=${room}`;
});
