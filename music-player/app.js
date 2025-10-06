/**
 * Music Player - supports local files (via Object URLs) and remote URLs.
 * Note: local files are not persisted across reloads; remote URLs are saved in localStorage.
 */

(() => {
  const audio = new Audio();
  audio.preload = "metadata";

  // State
  let playlist = [];
  let currentIndex = -1;
  let shuffle = false;
  let repeatMode = "off"; // "off" | "one" | "all"
  let isSeeking = false;

  // Elements
  const els = {
    nowTitle: document.getElementById("now-title"),
    nowArtist: document.getElementById("now-artist"),
    cover: document.getElementById("cover"),
    currentTime: document.getElementById("current-time"),
    duration: document.getElementById("duration"),
    progress: document.getElementById("progress"),
    prev: document.getElementById("prev"),
    play: document.getElementById("play"),
    next: document.getElementById("next"),
    shuffle: document.getElementById("shuffle"),
    repeat: document.getElementById("repeat"),
    mute: document.getElementById("mute"),
    volume: document.getElementById("volume"),
    addFiles: document.getElementById("add-files"),
    fileInput: document.getElementById("file-input"),
    addUrl: document.getElementById("add-url"),
    clear: document.getElementById("clear"),
    dropZone: document.getElementById("drop-zone"),
    playlist: document.getElementById("playlist"),
  };

  // Helpers
  const formatTime = (s) => {
    if (!Number.isFinite(s) || s < 0) return "00:00";
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  };

  const saveRemotePlaylist = () => {
    const remote = playlist.filter((t) => t.kind === "remote").map((t) => ({ url: t.url, title: t.title }));
    localStorage.setItem("music_player_remote", JSON.stringify(remote));
  };

  const loadRemotePlaylist = () => {
    try {
      const raw = localStorage.getItem("music_player_remote");
      if (!raw) return;
      const data = JSON.parse(raw);
      if (Array.isArray(data)) {
        for (const t of data) {
          addTrack({ title: t.title || t.url, url: t.url, kind: "remote" });
        }
      }
    } catch (e) {
      // ignore
    }
  };

  const deriveTitleFromURL = (url) => {
    try {
      const u = new URL(url);
      const name = u.pathname.split("/").filter(Boolean).pop() || url;
      return decodeURIComponent(name);
    } catch {
      return url;
    }
  };

  // Playlist ops
  const addTrack = (track) => {
    playlist.push({
      id: crypto.randomUUID(),
      title: track.title,
      url: track.url,
      kind: track.kind || "local",
    });
    renderPlaylist();
    if (currentIndex === -1) {
      playIndex(0);
    }
    if (track.kind === "remote") saveRemotePlaylist();
  };

  const addTracksFromFiles = (files) => {
    const arr = Array.from(files || []);
    if (!arr.length) return;
    for (const f of arr) {
      const url = URL.createObjectURL(f);
      addTrack({ title: f.name, url, kind: "local" });
    }
  };

  const removeTrackById = (id) => {
    const idx = playlist.findIndex((t) => t.id === id);
    if (idx === -1) return;
    // If removing current track, adjust currentIndex appropriately
    const removingCurrent = idx === currentIndex;
    playlist.splice(idx, 1);

    if (removingCurrent) {
      if (playlist.length === 0) {
        stopPlayback();
      } else {
        // Try to play same index (which is now next item), else previous one
        const nextIdx = Math.min(idx, playlist.length - 1);
        playIndex(nextIdx);
      }
    } else if (idx < currentIndex) {
      currentIndex -= 1;
    }
    renderPlaylist();
    saveRemotePlaylist();
  };

  const clearPlaylist = () => {
    stopPlayback();
    playlist = [];
    currentIndex = -1;
    renderPlaylist();
    saveRemotePlaylist(); // will save empty
  };

  // Playback ops
  const playIndex = (index) => {
    if (index < 0 || index >= playlist.length) return;
    currentIndex = index;
    const track = playlist[currentIndex];
    audio.src = track.url;
    audio.play().catch(() => {
      // playback might require user gesture depending on browser
    });
    updateNowPlaying(track);
    renderPlaylist();
    updatePlayButton();
    updateMediaSession(track);
  };

  const stopPlayback = () => {
    audio.pause();
    audio.removeAttribute("src");
    audio.load();
    updatePlayButton();
    els.nowTitle.textContent = "Tidak ada lagu";
    els.nowArtist.textContent = "—";
    els.progress.value = 0;
    els.currentTime.textContent = "00:00";
    els.duration.textContent = "00:00";
  };

  const togglePlay = () => {
    if (!audio.src) {
      if (playlist.length) playIndex(currentIndex === -1 ? 0 : currentIndex);
      return;
    }
    if (audio.paused) audio.play();
    else audio.pause();
    updatePlayButton();
  };

  const prevTrack = () => {
    if (!playlist.length) return;
    if (shuffle) {
      playIndex(randomIndexExcluding(currentIndex));
      return;
    }
    const prev = currentIndex - 1;
    if (prev >= 0) playIndex(prev);
    else if (repeatMode === "all") playIndex(playlist.length - 1);
  };

  const nextTrack = () => {
    if (!playlist.length) return;
    if (shuffle) {
      playIndex(randomIndexExcluding(currentIndex));
      return;
    }
    const next = currentIndex + 1;
    if (next < playlist.length) playIndex(next);
    else if (repeatMode === "all") playIndex(0);
    else stopPlayback();
  };

  const randomIndexExcluding = (excludeIdx) => {
    if (playlist.length <= 1) return excludeIdx;
    let idx;
    do {
      idx = Math.floor(Math.random() * playlist.length);
    } while (idx === excludeIdx);
    return idx;
  };

  const cycleRepeatMode = () => {
    repeatMode = repeatMode === "off" ? "one" : repeatMode === "one" ? "all" : "off";
    els.repeat.classList.toggle("active", repeatMode !== "off");
    const title = repeatMode === "off" ? "Ulangi: Off" : repeatMode === "one" ? "Ulangi: Satu" : "Ulangi: Semua";
    els.repeat.setAttribute("title", `${title} (klik untuk ubah)`);
  };

  const toggleShuffle = () => {
    shuffle = !shuffle;
    els.shuffle.classList.toggle("active", shuffle);
  };

  const toggleMute = () => {
    audio.muted = !audio.muted;
    els.mute.classList.toggle("active", audio.muted);
  };

  const setVolume = (val) => {
    const v = Math.max(0, Math.min(100, Number(val)));
    audio.volume = v / 100;
  };

  const seekPercent = (pct) => {
    if (!audio.duration || !Number.isFinite(audio.duration)) return;
    const clamped = Math.max(0, Math.min(100, Number(pct)));
    audio.currentTime = (clamped / 100) * audio.duration;
  };

  const updateNowPlaying = (track) => {
    els.nowTitle.textContent = track?.title || "Tidak ada lagu";
    els.nowArtist.textContent = track?.kind === "remote" ? "URL" : "File lokal";
  };

  const updatePlayButton = () => {
    // Using ⏯ glyph; keep button active styling when playing
    els.play.classList.toggle("active", !audio.paused && !!audio.src);
  };

  const updateProgressUI = () => {
    if (!audio.src) return;
    const cur = audio.currentTime || 0;
    const dur = audio.duration || 0;
    els.currentTime.textContent = formatTime(cur);
    els.duration.textContent = dur ? formatTime(dur) : "00:00";
    if (!isSeeking && dur > 0) {
      const pct = Math.min(100, Math.max(0, (cur / dur) * 100));
      els.progress.value = pct;
    }
  };

  const renderPlaylist = () => {
    els.playlist.innerHTML = "";
    playlist.forEach((t, idx) => {
      const li = document.createElement("li");
      li.className = "track" + (idx === currentIndex ? " active" : "");
      li.dataset.index = String(idx);

      const title = document.createElement("div");
      title.className = "track__title";
      title.textContent = t.title;

      const remove = document.createElement("button");
      remove.className = "track__remove";
      remove.title = "Hapus dari playlist";
      remove.textContent = "✖";

      remove.addEventListener("click", (e) => {
        e.stopPropagation();
        removeTrackById(t.id);
      });

      li.addEventListener("click", () => playIndex(idx));

      li.appendChild(title);
      li.appendChild(remove);
      els.playlist.appendChild(li);
    });
  };

  // Media Session integration
  const updateMediaSession = (track) => {
    if (!("mediaSession" in navigator)) return;
    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: track?.title || "Music Player",
        artist: track?.kind === "remote" ? "URL" : "File lokal",
        album: "Playlist",
        artwork: [
          { src: "../images/industry_usecase.png", sizes: "512x512", type: "image/png" },
        ],
      });

      navigator.mediaSession.setActionHandler("play", () => audio.play());
      navigator.mediaSession.setActionHandler("pause", () => audio.pause());
      navigator.mediaSession.setActionHandler("previoustrack", prevTrack);
      navigator.mediaSession.setActionHandler("nexttrack", nextTrack);
      navigator.mediaSession.setActionHandler("seekto", (details) => {
        if (typeof details.seekTime === "number") {
          audio.currentTime = details.seekTime;
        }
      });
    } catch {
      // ignore
    }
  };

  // Events
  audio.addEventListener("timeupdate", updateProgressUI);
  audio.addEventListener("durationchange", updateProgressUI);
  audio.addEventListener("play", updatePlayButton);
  audio.addEventListener("pause", updatePlayButton);
  audio.addEventListener("ended", () => {
    if (repeatMode === "one") {
      audio.currentTime = 0;
      audio.play();
    } else {
      nextTrack();
    }
  });

  // UI events
  els.play.addEventListener("click", togglePlay);
  els.prev.addEventListener("click", prevTrack);
  els.next.addEventListener("click", nextTrack);
  els.shuffle.addEventListener("click", toggleShuffle);
  els.repeat.addEventListener("click", cycleRepeatMode);
  els.mute.addEventListener("click", toggleMute);

  els.volume.addEventListener("input", (e) => setVolume(e.target.value));
  setVolume(els.volume.value);

  els.progress.addEventListener("input", (e) => {
    isSeeking = true;
    seekPercent(e.target.value);
  });
  els.progress.addEventListener("change", (e) => {
    isSeeking = false;
    seekPercent(e.target.value);
  });

  els.addFiles.addEventListener("click", () => els.fileInput.click());
  els.fileInput.addEventListener("change", (e) => addTracksFromFiles(e.target.files));

  els.addUrl.addEventListener("click", () => {
    const url = prompt("Masukkan URL audio (MP3/OGG/WAV/M4A):");
    if (!url) return;
    const title = prompt("Judul (opsional):") || deriveTitleFromURL(url);
    addTrack({ title, url, kind: "remote" });
  });

  els.clear.addEventListener("click", () => {
    if (confirm("Bersihkan seluruh playlist?")) {
      clearPlaylist();
    }
  });

  // Drag & drop
  const preventDefaults = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };
  ["dragenter", "dragover", "dragleave", "drop"].forEach((ev) => {
    els.dropZone.addEventListener(ev, preventDefaults, false);
    document.body.addEventListener(ev, preventDefaults, false);
  });
  ["dragenter", "dragover"].forEach((ev) => {
    els.dropZone.addEventListener(ev, () => els.dropZone.classList.add("dragover"));
  });
  ["dragleave", "drop"].forEach((ev) => {
    els.dropZone.addEventListener(ev, () => els.dropZone.classList.remove("dragover"));
  });
  els.dropZone.addEventListener("drop", (e) => {
    const dt = e.dataTransfer;
    if (!dt) return;
    const files = dt.files;
    addTracksFromFiles(files);
  });

  // Keyboard shortcuts
  window.addEventListener("keydown", (e) => {
    if (e.target && (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA")) return;
    switch (e.key) {
      case " ":
        e.preventDefault();
        togglePlay();
        break;
      case "ArrowRight":
        audio.currentTime = Math.min((audio.currentTime || 0) + 5, audio.duration || audio.currentTime + 5);
        break;
      case "ArrowLeft":
        audio.currentTime = Math.max((audio.currentTime || 0) - 5, 0);
        break;
      case "ArrowUp":
        els.volume.value = String(Math.min(100, Number(els.volume.value) + 5));
        setVolume(els.volume.value);
        break;
      case "ArrowDown":
        els.volume.value = String(Math.max(0, Number(els.volume.value) - 5));
        setVolume(els.volume.value);
        break;
    }
  });

  // Boot
  loadRemotePlaylist();
  renderPlaylist();
})();