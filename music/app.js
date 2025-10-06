const audio = document.getElementById('audio');
const fileInput = document.getElementById('file-input');
const clearBtn = document.getElementById('clear-playlist');

const titleEl = document.getElementById('track-title');
const artistEl = document.getElementById('track-artist');

const playBtn = document.getElementById('play');
const playIcon = document.getElementById('play-icon');
const prevBtn = document.getElementById('prev');
const nextBtn = document.getElementById('next');

const seekEl = document.getElementById('seek');
const currentTimeEl = document.getElementById('current-time');
const durationEl = document.getElementById('duration');

const muteBtn = document.getElementById('mute');
const muteIcon = document.getElementById('mute-icon');
const volumeEl = document.getElementById('volume');

const playlistEl = document.getElementById('playlist-list');
const artworkEl = document.getElementById('artwork');

// State
let playlist = [];
let index = -1;
let isPlaying = false;

const formatTime = secs => {
  if (!Number.isFinite(secs)) return '0:00';
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
};

// File handling
fileInput.addEventListener('change', async (e) => {
  const files = Array.from(e.target.files || []);
  if (!files.length) return;

  const newItems = await Promise.all(files.map(async (file) => {
    const url = URL.createObjectURL(file);
    const meta = await extractMetadata(file).catch(() => ({}));
    return {
      url,
      name: file.name,
      size: file.size,
      type: file.type,
      title: meta.title || file.name.replace(/\.[^/.]+$/, ''),
      artist: meta.artist || 'Tidak diketahui',
    };
  }));

  playlist = playlist.concat(newItems);
  renderPlaylist();

  if (index === -1 && playlist.length) {
    loadTrack(0);
    play();
  }
});

// Metadata extraction (basic using MediaMetadata)
async function extractMetadata(file){
  // Browsers do not give ID3 easily; we leverage file name heuristic.
  // Placeholder for future improvements if needed.
  return {
    title: file.name.replace(/\.[^/.]+$/, ''),
    artist: 'Tidak diketahui'
  };
}

// Playlist rendering
function renderPlaylist(){
  playlistEl.innerHTML = '';
  if (!playlist.length){
    const empty = document.createElement('li');
    empty.className = 'list-item';
    empty.innerHTML = '<span class="badge">Playlist kosong — unggah lagu untuk mulai</span>';
    playlistEl.appendChild(empty);
    return;
  }

  playlist.forEach((item, i) => {
    const li = document.createElement('li');
    li.className = 'list-item';
    const isCurrent = i === index;

    li.innerHTML = `
      <span class="material-symbols-outlined">${isCurrent ? 'play_circle' : 'music_note'}</span>
      <div class="meta">
        <div class="title">${item.title}</div>
        <div class="subtitle">${item.artist} • ${(item.size/1024/1024).toFixed(2)} MB</div>
      </div>
      <div class="actions">
        <button class="icon-btn" data-action="play" title="Putar"><span class="material-symbols-outlined">play_arrow</span></button>
        <button class="icon-btn" data-action="remove" title="Hapus"><span class="material-symbols-outlined">delete</span></button>
      </div>
    `;

    li.querySelector('[data-action="play"]').addEventListener('click', () => {
      loadTrack(i);
      play();
    });
    li.querySelector('[data-action="remove"]').addEventListener('click', () => {
      removeTrack(i);
    });

    playlistEl.appendChild(li);
  });
}

function removeTrack(i){
  if (i < 0 || i >= playlist.length) return;
  const wasCurrent = i === index;
  playlist.splice(i,1);

  if (wasCurrent){
    if (playlist.length){
      const newIndex = Math.min(i, playlist.length - 1);
      loadTrack(newIndex);
      play();
    } else {
      stop();
      index = -1;
      titleEl.textContent = 'Tidak ada lagu';
      artistEl.textContent = '—';
      seekEl.value = 0;
      durationEl.textContent = '0:00';
      currentTimeEl.textContent = '0:00';
    }
  }
  renderPlaylist();
}

clearBtn.addEventListener('click', () => {
  stop();
  playlist.forEach(item => URL.revokeObjectURL(item.url));
  playlist = [];
  index = -1;
  renderPlaylist();
});

// Playback
function loadTrack(i){
  if (i < 0 || i >= playlist.length) return;
  index = i;
  const item = playlist[index];
  audio.src = item.url;
  titleEl.textContent = item.title;
  artistEl.textContent = item.artist;
  artworkEl.classList.add('pulse');
  setTimeout(() => artworkEl.classList.remove('pulse'), 400);
}

function play(){
  if (!audio.src) return;
  audio.play();
  isPlaying = true;
  playIcon.textContent = 'pause';
}

function pause(){
  audio.pause();
  isPlaying = false;
  playIcon.textContent = 'play_arrow';
}

function stop(){
  pause();
  audio.currentTime = 0;
}

playBtn.addEventListener('click', () => {
  if (!audio.src) return;
  if (isPlaying) pause(); else play();
});
prevBtn.addEventListener('click', () => {
  if (!playlist.length) return;
  const nextIndex = (index - 1 + playlist.length) % playlist.length;
  loadTrack(nextIndex);
  play();
});
nextBtn.addEventListener('click', () => {
  if (!playlist.length) return;
  const nextIndex = (index + 1) % playlist.length;
  loadTrack(nextIndex);
  play();
});

audio.addEventListener('loadedmetadata', () => {
  durationEl.textContent = formatTime(audio.duration);
});
audio.addEventListener('timeupdate', () => {
  currentTimeEl.textContent = formatTime(audio.currentTime);
  if (Number.isFinite(audio.duration)){
    const pct = (audio.currentTime / audio.duration) * 100;
    seekEl.value = pct;
  }
});
audio.addEventListener('ended', () => {
  // Auto play next
  if (playlist.length){
    const nextIndex = (index + 1) % playlist.length;
    loadTrack(nextIndex);
    play();
  } else {
    pause();
  }
});

// Seek and volume
seekEl.addEventListener('input', () => {
  if (!Number.isFinite(audio.duration)) return;
  audio.currentTime = (seekEl.value / 100) * audio.duration;
});

muteBtn.addEventListener('click', () => {
  audio.muted = !audio.muted;
  muteIcon.textContent = audio.muted ? 'volume_off' : 'volume_up';
});
volumeEl.addEventListener('input', () => {
  audio.volume = Number(volumeEl.value);
  if (audio.volume === 0) muteIcon.textContent = 'volume_off';
  else if (audio.volume < 0.4) muteIcon.textContent = 'volume_down';
  else muteIcon.textContent = 'volume_up';
});

// Visualizer using Web Audio API
let audioCtx, analyser, dataArray;
function setupVisualizer(){
  if (audioCtx) return; // already
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  const source = audioCtx.createMediaElementSource(audio);
  analyser = audioCtx.createAnalyser();
  analyser.fftSize = 512;
  const gain = audioCtx.createGain();
  gain.gain.value = 1.0;
  source.connect(analyser);
  analyser.connect(gain);
  gain.connect(audioCtx.destination);
  dataArray = new Uint8Array(analyser.frequencyBinCount);
}
setupVisualizer();

const canvas = document.getElementById('viz');
const ctx = canvas.getContext('2d');

function resizeCanvas(){
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  canvas.width = Math.floor(w * dpr);
  canvas.height = Math.floor(h * dpr);
  ctx.setTransform(dpr,0,0,dpr,0,0);
}
addEventListener('resize', resizeCanvas);
resizeCanvas();

function draw(){
  requestAnimationFrame(draw);
  if (!analyser) return;
  analyser.getByteFrequencyData(dataArray);

  ctx.clearRect(0,0,canvas.width,canvas.height);
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  const barCount = 64;
  const step = Math.floor(dataArray.length / barCount);

  for (let i=0;i<barCount;i++){
    const val = dataArray[i*step]/255;
    const x = (i / barCount) * w;
    const bw = (w / barCount) - 2;
    const bh = h * Math.pow(val, 1.5);
    const gradient = ctx.createLinearGradient(x, h - bh, x, h);
    gradient.addColorStop(0, '#6e9cff');
    gradient.addColorStop(1, '#9bffb0');
    ctx.fillStyle = gradient;
    ctx.fillRect(x, h - bh, bw, bh);
  }
}
draw();

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
  if (e.target && ['INPUT','TEXTAREA'].includes(e.target.tagName)) return;
  switch(e.key){
    case ' ':
      e.preventDefault();
      if (isPlaying) pause(); else play();
      break;
    case 'ArrowRight':
      audio.currentTime += 5;
      break;
    case 'ArrowLeft':
      audio.currentTime -= 5;
      break;
  }
});