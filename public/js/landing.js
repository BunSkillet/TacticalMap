const urlParams = new URLSearchParams(window.location.search);
if (urlParams.get('invalidRoom') === '1') {
  alert('Invalid room code');
  // remove the query parameter so the alert doesn't keep showing
  urlParams.delete('invalidRoom');
  const newUrl = window.location.pathname + (urlParams.toString() ? '?' + urlParams.toString() : '');
  window.history.replaceState({}, '', newUrl);
}

const header = document.getElementById('button-container');
window.addEventListener('scroll', () => {
  if (window.scrollY > header.offsetHeight) {
    header.classList.add('scrolled');
  } else {
    header.classList.remove('scrolled');
  }
});

const hostBtn = document.getElementById('host-btn');
const joinBtn = document.getElementById('join-btn');
const hostForm = document.getElementById('host-form');
const joinForm = document.getElementById('join-form');

function toggleForm(type) {
  if (type === 'host') {
    hostBtn.classList.add('active');
    joinBtn.classList.remove('active');
    hostForm.classList.add('show');
    joinForm.classList.remove('show');
  } else {
    joinBtn.classList.add('active');
    hostBtn.classList.remove('active');
    joinForm.classList.add('show');
    hostForm.classList.remove('show');
  }
}

async function hostRoom() {
  const username = document.getElementById('host-username').value.trim();
  if (!username) return;
  try {
    const resp = await fetch('/host', { method: 'POST' });
    const data = await resp.json();
    const code = encodeURIComponent(data.code);
    window.location.href = `board.html?username=${encodeURIComponent(username)}&room=${code}&host=1`;
  } catch (err) {
    alert('Failed to create room');
  }
}

function joinRoom() {
  const username = document.getElementById('join-username').value.trim();
  const room = document.getElementById('join-code').value.trim();
  if (!username || !room) return;
  window.location.href = `board.html?username=${encodeURIComponent(username)}&room=${encodeURIComponent(room)}`;
}

hostBtn.addEventListener('click', () => toggleForm('host'));
joinBtn.addEventListener('click', () => toggleForm('join'));
document.getElementById('host-confirm').addEventListener('click', hostRoom);
document.getElementById('join-confirm').addEventListener('click', joinRoom);
