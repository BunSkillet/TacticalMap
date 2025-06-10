const urlParams = new URLSearchParams(window.location.search);
if (urlParams.get('invalidRoom') === '1') {
  alert('Invalid room code');
}

const header = document.getElementById('button-container');
window.addEventListener('scroll', () => {
  if (window.scrollY > header.offsetHeight) {
    header.classList.add('scrolled');
  } else {
    header.classList.remove('scrolled');
  }
});

async function hostRoom() {
  const name = prompt('Enter your name');
  if (!name) return;
  try {
    const resp = await fetch('/host', { method: 'POST' });
    const data = await resp.json();
    const code = encodeURIComponent(data.code);
    window.location.href = `board.html?name=${encodeURIComponent(name)}&room=${code}&host=1`;
  } catch (err) {
    alert('Failed to create room');
  }
}

function joinRoom() {
  const name = prompt('Enter your name');
  if (!name) return;
  const room = prompt('Enter room code');
  if (!room) return;
  window.location.href = `board.html?name=${encodeURIComponent(name)}&room=${encodeURIComponent(room)}`;
}

document.getElementById('host-btn').addEventListener('click', hostRoom);
document.getElementById('join-btn').addEventListener('click', joinRoom);
