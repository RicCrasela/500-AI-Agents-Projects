// Genie Music Player - vanilla JS
(() => {
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const audio = $('#audio');
  const playlistEl = $('#playlist');
  const fileInput = $('#fileInput');
  const urlForm = $('#urlForm');
  const urlInput = $('#urlInput');
  const dropZone = $('#dropZone');
  const searchInput = $('#searchInput');
  const filterFavBtn = $('#filterFav');

  const btnShuffle = $('#btnShuffle');
  const btnPrev = $('#btnPrev');
  const btnPlay = $('#btnPlay');
  const btnNext = $('#btnNext');
  const btnRepeat = $('#btnRepeat');
  const btnMute = $('#btnMute');
  const btnClear = $('#btnClear');

  const titleEl = $('#title');
  const artistEl = $('#artist');
  const coverEl = $('#cover');

  const seekEl = $('#seek');
  const currentTimeEl = $('#currentTime');
  const totalTimeEl = $('#totalTime');
  const volumeEl = $('#volume');

  const canvas = $('#visualizer');
  const ctx = canvas.getContext('2d');

  // State
  let state = {
    items: [], // {id, srcType: 'file'|'url', src, title, artist, favorite}
    index: -1,
    shuffle: false,
    repeat: 'off', // 'off' | 'all' | 'one'
    filterFav: false,
    search: '',
  };

  const uid = () => Math.random().toString(36).slice(2);

  // Persistence (URLs and favorites only; local File object URLs are session-only)
  const saveState = () => {
    const urlItems = state.items
      .filter(i => i.srcType === 'url')
      .map(({ id, src, title, artist, favorite }) => ({ id, src, title, artist, favorite }));
    localStorage.setItem('gm_playlist_urls', JSON.stringify(urlItems));
    localStorage.setItem('gm_settings', JSON.stringify({
      shuffle: state.shuffle,
      repeat: state.repeat,
      volume: audio.volume,
    }));
  };
  const loadState = () => {
    try {
      const urlItems = JSON.parse(localStorage.getItem('gm_playlist_urls') || '[]');
      const settings = JSON.parse(localStorage.getItem('gm_settings') || '{}');
      if (Array.isArray(urlItems)) {
        state.items.push(...urlItems.map(o => ({ ...o, srcType: 'url' })));
      }
      if ('shuffle' in settings) state.shuffle = !!settings.shuffle;
      if ('repeat' in settings) state.repeat = settings.repeat;
      if ('volume' in settings) audio.volume = settings.volume;
    } catch (e) {}
  };

  loadState();

  // Visualizer setup
  const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  const srcNode = audioCtx.createMediaElementSource(audio);
  const analyser = audioCtx.createAnalyser();
  analyser.fftSize = 2048;
  srcNode.connect(analyser);
  analyser.connect(audioCtx.destination);

  const draw = () => {
    const { width } = canvas.getBoundingClientRect();
    canvas.width = Math.floor(width);
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    analyser.getByteFrequencyData(dataArray);

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const barWidth = (canvas.width / bufferLength) * 2.5;
    let x = 0;
    for (let i = 0; i < bufferLength; i++) {
      const v = dataArray[i] / 255;
      const h = v * canvas.height;
      ctx.fillStyle = `hsl(${220 + v*40} 70% ${40 + v*20}%)`;
      ctx.fillRect(x, canvas.height - h, barWidth, h);
      x += barWidth + 1;
      if (x > canvas.width) break;
    }
    requestAnimationFrame(draw);
  };
  requestAnimationFrame(draw);

  // Helpers
  const formatTime = (sec) => {
    if (!isFinite(sec)) return '0:00';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const computeArtistFromTitle = (name) => {
    const parts = String(name).split(' - ');
    return parts.length > 1 ? { artist: parts[0], title: parts.slice(1).join(' - ') } : { artist: 'Unknown', title: name };
  };

  const render = () => {
    // header states
    btnShuffle.classList.toggle('primary', state.shuffle);
    btnRepeat.textContent = `Repeat: ${state.repeat[0].toUpperCase()}${state.repeat.slice(1)}`;
    filterFavBtn.classList.toggle('primary', state.filterFav);

    // playlist
    const term = state.search.trim().toLowerCase();
    const items = state.items.filter(it => {
      if (state.filterFav && !it.favorite) return false;
      if (!term) return true;
      return (it.title || '').toLowerCase().includes(term) || (it.artist || '').toLowerCase().includes(term);
    });

    playlistEl.innerHTML = '';
    items.forEach((it, visibleIdx) => {
      const li = document.createElement('li');
      li.className = 'track' + (state.items[state.index]?.id === it.id ? ' active' : '');
      li.dataset.id = it.id;

      const drag = document.createElement('span');
      drag.className = 'handle';
      drag.textContent = '⋮⋮';

      const fav = document.createElement('button');
      fav.className = 'fav';
      fav.title = 'Tandai favorit';
      fav.textContent = it.favorite ? '★' : '☆';
      fav.addEventListener('click', (e) => {
        e.stopPropagation();
        it.favorite = !it.favorite;
        saveState();
        render();
      });

      const meta = document.createElement('div');
      meta.className = 'meta';
      const title = document.createElement('div');
      title.className = 'title';
      title.textContent = it.title || 'Tanpa judul';
      const artist = document.createElement('div');
      artist.className = 'artist';
      artist.textContent = it.artist || 'Unknown';
      meta.appendChild(title); meta.appendChild(artist);

      const actions = document.createElement('div');
      actions.className = 'actions';
      const upBtn = document.createElement('button');
      upBtn.className = 'ghost';
      upBtn.textContent = '↑';
      upBtn.title = 'Naikkan';
      upBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        moveItem(it.id, -1);
      });
      const downBtn = document.createElement('button');
      downBtn.className = 'ghost';
      downBtn.textContent = '↓';
      downBtn.title = 'Turunkan';
      downBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        moveItem(it.id, +1);
      });
      const delBtn = document.createElement('button');
      delBtn.className = 'ghost danger';
      delBtn.textContent = 'Hapus';
      delBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        removeItem(it.id);
      });
      actions.append(upBtn, downBtn, delBtn);

      const playBtn = document.createElement('button');
      playBtn.className = 'ghost';
      playBtn.textContent = 'Putar';
      playBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        playById(it.id);
      });

      li.append(drag, fav, meta, actions, playBtn);
      li.addEventListener('click', () => playById(it.id));
      playlistEl.appendChild(li);
    });

    // now playing
    const current = state.items[state.index];
    titleEl.textContent = current ? current.title : 'Tidak ada lagu';
    artistEl.textContent = current ? (current.artist || 'Unknown') : '—';
  };

  const addUrl = (urlStr) => {
    try {
      const u = new URL(urlStr);
      const name = decodeURIComponent(u.pathname.split('/').pop() || 'Unknown');
      const { artist, title } = computeArtistFromTitle(name.replace(/\.(mp3|ogg|m4a|aac|wav)$/i, ''));
      state.items.push({
        id: uid(), srcType: 'url', src: urlStr, title, artist, favorite: false
      });
      saveState();
      render();
    } catch (e) {
      alert('URL tidak valid');
    }
  };

  const addFiles = (files) => {
    [...files].forEach(file => {
      const url = URL.createObjectURL(file);
      const base = file.name.replace(/\.(mp3|ogg|m4a|aac|wav)$/i, '');
      const { artist, title } = computeArtistFromTitle(base);
      state.items.push({
        id: uid(), srcType: 'file', src: url, title, artist, favorite: false
      });
    });
    render();
  };

  const removeItem = (id) => {
    const idx = state.items.findIndex(i => i.id === id);
    if (idx === -1) return;
    if (state.items[idx].srcType === 'file') {
      try { URL.revokeObjectURL(state.items[idx].src); } catch (e) {}
    }
    state.items.splice(idx, 1);
    if (idx === state.index) {
      stop();
      state.index = -1;
    } else if (idx < state.index) {
      state.index -= 1;
    }
    saveState();
    render();
  };

  const moveItem = (id, delta) => {
    const idx = state.items.findIndex(i => i.id === id);
    if (idx === -1) return;
    const nidx = Math.max(0, Math.min(state.items.length - 1, idx + delta));
    if (idx === nidx) return;
    const [item] = state.items.splice(idx, 1);
    state.items.splice(nidx, 0, item);
    if (state.index === idx) state.index = nidx;
    else if (idx < state.index && nidx >= state.index) state.index -= 1;
    else if (idx > state.index && nidx <= state.index) state.index += 1;
    saveState();
    render();
  };

  const findNextIndex = (dir = +1) => {
    if (state.repeat === 'one') return state.index; // repeat current
    if (state.shuffle) {
      if (state.items.length <= 1) return state.index;
      let n;
      do { n = Math.floor(Math.random() * state.items.length); } while (n === state.index && state.items.length > 1);
      return n;
    }
    let nidx = state.index + dir;
    if (nidx >= state.items.length) return state.repeat === 'all' ? 0 : -1;
    if (nidx < 0) return state.repeat === 'all' ? state.items.length - 1 : -1;
    return nidx;
  };

  const loadAtIndex = (idx) => {
    if (idx < 0 || idx >= state.items.length) return false;
    state.index = idx;
    const it = state.items[idx];
    audio.src = it.src;
    audio.play().catch(() => {});
    audio.dispatchEvent(new Event('play')); // force visual updates
    render();
    return true;
  };

  const playById = (id) => {
    const idx = state.items.findIndex(i => i.id === id);
    if (idx !== -1) loadAtIndex(idx);
  };

  const playPause = () => {
    if (!audio.src) {
      if (state.items.length) loadAtIndex(0);
      return;
    }
    if (audio.paused) audio.play();
    else audio.pause();
  };

  const stop = () => {
    audio.pause();
    audio.currentTime = 0;
    updatePlayButton();
  };

  const next = () => {
    const nidx = findNextIndex(+1);
    if (nidx === -1) stop();
    else loadAtIndex(nidx);
  };
  const prev = () => {
    if (audio.currentTime > 3) { audio.currentTime = 0; return; }
    const nidx = findNextIndex(-1);
    if (nidx === -1) stop();
    else loadAtIndex(nidx);
  };

  const updatePlayButton = () => {
    const iconPlay = $('#iconPlay');
    const iconPause = $('#iconPause');
    if (audio.paused) {
      iconPlay.style.display = '';
      iconPause.style.display = 'none';
    } else {
      iconPlay.style.display = 'none';
      iconPause.style.display = '';
    }
  };

  // Events
  fileInput.addEventListener('change', (e) => addFiles(e.target.files));
  urlForm.addEventListener('submit', (e) => {
    e.preventDefault();
    addUrl(urlInput.value.trim());
    urlInput.value = '';
  });

  // Drag & drop
  ;['dragenter','dragover'].forEach(evt => dropZone.addEventListener(evt, (e) => {
    e.preventDefault(); e.stopPropagation();
    dropZone.classList.add('drag');
  }));
  ;['dragleave','drop'].forEach(evt => dropZone.addEventListener(evt, (e) => {
    e.preventDefault(); e.stopPropagation();
    dropZone.classList.remove('drag');
  }));
  dropZone.addEventListener('drop', (e) => {
    const files = Array.from(e.dataTransfer.files || []).filter(f => f.type.startsWith('audio/'));
    if (files.length) addFiles(files);
  });

  // Filters
  searchInput.addEventListener('input', (e) => {
    state.search = e.target.value;
    render();
  });
  filterFavBtn.addEventListener('click', () => {
    state.filterFav = !state.filterFav;
    render();
  });

  // Transport & options
  btnShuffle.addEventListener('click', () => { state.shuffle = !state.shuffle; saveState(); render(); });
  btnRepeat.addEventListener('click', () => {
    state.repeat = state.repeat === 'off' ? 'all' : state.repeat === 'all' ? 'one' : 'off';
    saveState(); render();
  });
  btnPrev.addEventListener('click', prev);
  btnNext.addEventListener('click', next);
  btnPlay.addEventListener('click', playPause);
  btnMute.addEventListener('click', () => {
    audio.muted = !audio.muted;
    btnMute.textContent = audio.muted ? '🔇' : '🔈';
  });
  btnClear.addEventListener('click', () => {
    if (!confirm('Hapus semua item playlist?')) return;
    // revoke existing object URLs
    state.items.filter(i => i.srcType === 'file').forEach(i => { try{URL.revokeObjectURL(i.src)}catch(e){} });
    state.items = [];
    state.index = -1;
    stop();
    saveState();
    render();
  });

  // Seek & volume
  audio.addEventListener('timeupdate', () => {
    currentTimeEl.textContent = formatTime(audio.currentTime);
    totalTimeEl.textContent = formatTime(audio.duration);
    if (audio.duration) seekEl.value = (audio.currentTime / audio.duration) * 100;
  });
  audio.addEventListener('loadedmetadata', () => {
    totalTimeEl.textContent = formatTime(audio.duration);
  });
  seekEl.addEventListener('input', () => {
    if (!audio.duration) return;
    const t = (seekEl.value/100) * audio.duration;
    audio.currentTime = t;
  });
  volumeEl.addEventListener('input', () => {
    audio.volume = parseFloat(volumeEl.value);
    saveState();
  });

  audio.addEventListener('play', updatePlayButton);
  audio.addEventListener('pause', updatePlayButton);
  audio.addEventListener('ended', () => {
    if (state.repeat === 'one') { audio.currentTime = 0; audio.play(); return; }
    next();
  });

  // Keyboard shortcuts
  window.addEventListener('keydown', (e) => {
    if (['INPUT','TEXTAREA'].includes(e.target.tagName)) return;
    switch (e.key.toLowerCase()) {
      case ' ': e.preventDefault(); playPause(); break;
      case 'arrowleft': audio.currentTime = Math.max(0, audio.currentTime - 5); break;
      case 'arrowright': audio.currentTime = Math.min(audio.duration||0, audio.currentTime + 5); break;
      case 'arrowup': audio.volume = Math.min(1, audio.volume + 0.05); volumeEl.value = audio.volume; saveState(); break;
      case 'arrowdown': audio.volume = Math.max(0, audio.volume - 0.05); volumeEl.value = audio.volume; saveState(); break;
      case 'n': next(); break;
      case 'p': prev(); break;
      case 's': state.shuffle = !state.shuffle; saveState(); render(); break;
      case 'r': state.repeat = state.repeat === 'off' ? 'all' : state.repeat === 'all' ? 'one' : 'off'; saveState(); render(); break;
      case 'm': audio.muted = !audio.muted; btnMute.textContent = audio.muted ? '🔇' : '🔈'; break;
    }
  });

  // Import/Export playlist (URLs only)
  $('#exportPlaylist').addEventListener('click', () => {
    const data = {
      version: 1,
      createdAt: new Date().toISOString(),
      items: state.items.filter(i => i.srcType === 'url').map(({src, title, artist, favorite}) => ({src, title, artist, favorite}))
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'rico-crasela-music-playlist.json';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });

  $('#importInput').addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      if (!Array.isArray(data.items)) throw new Error('Format tidak valid');
      data.items.forEach(it => {
        state.items.push({
          id: uid(), srcType: 'url', src: it.src, title: it.title, artist: it.artist, favorite: !!it.favorite
        });
      });
      saveState();
      render();
    } catch (err) {
      alert('Gagal import: ' + err.message);
    } finally {
      e.target.value = '';
    }
  });

  // Basic PWA install prompt (optional; may not be available)
  let deferredPrompt = null;
  const installBtn = $('#installPWA');
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    if (installBtn) installBtn.style.display = '';
  });
  if (installBtn) {
    installBtn.addEventListener('click', async () => {
      if (!deferredPrompt) return;
      deferredPrompt.prompt();
      await deferredPrompt.userChoice;
      deferredPrompt = null;
      installBtn.style.display = 'none';
    });
  }

  // Initial render
  render();
})();