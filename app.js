document.getElementById('btn').onclick = async () => {
  const text = document.getElementById('text').value.trim();
  const esp = document.getElementById('esp').value.trim();
  if(!text || !esp) { alert('enter text + esp ip'); return; }
  // play locally (phone)
  speechSynthesis.speak(new SpeechSynthesisUtterance(text));
  // send to esp32
  try {
    const res = await fetch(`http://${esp}/play?text=${encodeURIComponent(text)}`);
    document.getElementById('info').textContent = res.ok ? 'Sent to ESP32' : 'ESP32 error: '+res.status;
  } catch(e) {
    document.getElementById('info').textContent = 'Network error: '+e.message;
  }
};
