/**
 * YouTube Player App (no Data API key required).
 * - Adds videos by URL or ID
 * - Persists playlist via localStorage
 * - Import/Export playlist (JSON)
 * - Uses YouTube IFrame API for playback control
 */

(() => {
  // State
  let playlist = [];
  let currentIndex = -1;
  let shuffle = false;
  let repeatMode = "off"; // "off" | "one" | "all"
  let player = null;
  let progressTimer = null;
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
    addUrl: document.getElementById("add-url"),
    importBtn: document.getElementById("import"),
    importFile: document.getElementById("import-file"),
    exportBtn: document.getElementById("export"),
    clear: document.getElementById("clear"),
    playlist: document.getElementById("playlist"),
  };

  // YouTube IFrame API bootstrapping
  window.onYouTubeIframeAPIReady = () => {
    player = new YT.Player("player", {
      height: "360",
      width: "640",
      videoId: null,
      playerVars: {
        modestbranding: 1,
        rel: 0,
        playsinline: 1,
        color: "white",
      },
      events: {
        onReady: onPlayerReady,
        onStateChange: onPlayerStateChange,
      },
    });
  };

  const onPlayerReady = () => {
    setVolume(els.volume.value);
    loadPersistedPlaylist();
    renderPlaylist();
  };

  const onPlayerStateChange = (event) => {
    // YT.PlayerState: -1:unstarted, 0:ended, 1:playing, 2:paused, 3:buffering, 5:cued
    if (event.data === YT.PlayerState.PLAYING) {
      updatePlayButton();
      startProgressTimer();
    } else if (event.data === YT.PlayerState.PAUSED) {
      updatePlayButton();
      stopProgressTimer();
    } else if (event.data === YT.PlayerState.ENDED) {
      if (repeatMode === "one") {
        player.seekTo(0, true);
        player.playVideo();
      } else {
        nextTrack();
      }
    }
  };

  // Helpers
  const formatTime = (s) => {
    if (!Number.isFinite(s) || s < 0) return "00:00";
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  };

  const savePlaylist = () => {
    localStorage.setItem("youtube_player_playlist", JSON.stringify(playlist));
  };

  const loadPersistedPlaylist = () => {
    try {
      const raw = localStorage.getItem("youtube_player_playlist");
      if (!raw) return;
      const data = JSON.parse(raw);
      if (Array.isArray(data)) {
        playlist = data.filter(Boolean);
        if (playlist.length) {
          playIndex(0);
        }
      }
    } catch {
      // ignore
    }
  };

  const parseVideoId = (input) => {
    const trimmed = String(input).trim();
    if (!trimmed) return null;

    // If only ID (11 chars typical), accept
    if (/^[a-zA-Z0-9_-]{10,}$/.test(trimmed) && !trimmed.includes("http")) {
      return trimmed;
    }

    // Try common URL formats
    try {
      const u = new URL(trimmed);
      if (u.hostname.includes("youtube.com")) {
        const v = u.searchParams.get("v");
        if (v) return v;
        // short urls like /watch?v=ID or share formats
        const pathnameParts = u.pathname.split("/").filter(Boolean);
        if (pathnameParts[0] === "embed" && pathnameParts[1]) return pathnameParts[1];
      } else if (u.hostname.includes("youtu.be")) {
        const id = u.pathname.split("/").filter(Boolean)[0];
        if (id) return id;
      }
      return null;
    } catch {
      return null;
    }
  };

  const thumbURL = (id) =>
    `https://img.youtube.com/vi/${encodeURIComponent(id)}/hqdefault.jpg`;

  const deriveTitle = async (id) => {
    // Try oEmbed (may be blocked by CORS in some environments). Fallback to ID.
    const url = `https://www.youtube.com/oembed?url=${encodeURIComponent(`https://www.youtube.com/watch?v=${id}`)}&format=json`;
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error("oEmbed failed");
      const data = await res.json();
      return data.title || id;
    } catch {
      return id;
    }
  };

  // Playlist ops
  const addTrack = async ({ id, title }) => {
    const t = {
      id,
      title: title || (await deriveTitle(id)),
    };
    playlist.push(t);
    savePlaylist();
    renderPlaylist();
    if (currentIndex === -1) playIndex(0);
  };

  const removeTrackById = (id) => {
    const idx = playlist.findIndex((t) => t.id === id);
    if (idx === -1) return;
    const removingCurrent = idx === currentIndex;
    playlist.splice(idx, 1);

    if (removingCurrent) {
      if (!playlist.length) {
        stopPlayback();
      } else {
        const nextIdx = Math.min(idx, playlist.length - 1);
        playIndex(nextIdx);
      }
    } else if (idx < currentIndex) {
      currentIndex -= 1;
    }
    renderPlaylist();
    savePlaylist();
  };

  const clearPlaylist = () => {
    stopPlayback();
    playlist = [];
    currentIndex = -1;
    renderPlaylist();
    savePlaylist();
  };

  const exportPlaylist = () => {
    const data = {
      schema: "youtube-player.v1",
      items: playlist.map((t) => ({ id: t.id, title: t.title })),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "youtube_playlist.json";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const importPlaylistFromFile = async (file) => {
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      if (!data || data.schema !== "youtube-player.v1" || !Array.isArray(data.items)) {
        alert("Format file tidak valid.");
        return;
      }
      // Replace playlist
      playlist = [];
      for (const item of data.items) {
        if (item && item.id) {
          await addTrack({ id: item.id, title: item.title });
        }
      }
      if (playlist.length) playIndex(0);
      savePlaylist();
    } catch {
      alert("Gagal mengimpor playlist.");
    }
  };

  // Playback ops
  const playIndex = (index) => {
    if (!player || index < 0 || index >= playlist.length) return;
    currentIndex = index;
    const track = playlist[currentIndex];
    player.loadVideoById(track.id);
    updateNowPlaying(track);
    renderPlaylist();
    updatePlayButton();
  };

  const stopPlayback = () => {
    if (!player) return;
    player.stopVideo();
    updatePlayButton();
    els.nowTitle.textContent = "Tidak ada video";
    els.nowArtist.textContent = "YouTube";
    els.progress.value = 0;
    els.currentTime.textContent = "00:00";
    els.duration.textContent = "00:00";
    stopProgressTimer();
  };

  const togglePlay = () => {
    if (!player) return;
    const state = player.getPlayerState();
    if (state === YT.PlayerState.PLAYING) player.pauseVideo();
    else player.playVideo();
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
    if (!player) return;
    if (player.isMuted()) player.unMute();
    else player.mute();
    els.mute.classList.toggle("active", player.isMuted());
  };

  const setVolume = (val) => {
    if (!player) return;
    const v = Math.max(0, Math.min(100, Number(val)));
    player.setVolume(v);
  };

  const seekPercent = (pct) => {
    if (!player) return;
    const dur = player.getDuration() || 0;
    if (dur <= 0) return;
    const clamped = Math.max(0, Math.min(100, Number(pct)));
    player.seekTo((clamped / 100) * dur, true);
  };

  const updateNowPlaying = (track) => {
    els.nowTitle.textContent = track?.title || "Tidak ada video";
    els.nowArtist.textContent = "YouTube";
  };

  const updatePlayButton = () => {
    if (!player) return;
    const isPlaying = player.getPlayerState() === YT.PlayerState.PLAYING;
    els.play.classList.toggle("active", isPlaying);
  };

  const updateProgressUI = () => {
    if (!player) return;
    const cur = player.getCurrentTime() || 0;
    const dur = player.getDuration() || 0;
    els.currentTime.textContent = formatTime(cur);
    els.duration.textContent = dur ? formatTime(dur) : "00:00";
    if (!isSeeking && dur > 0) {
      const pct = Math.min(100, Math.max(0, (cur / dur) * 100));
      els.progress.value = pct;
    }
  };

  const startProgressTimer = () => {
    stopProgressTimer();
    progressTimer = setInterval(updateProgressUI, 250);
  };

  const stopProgressTimer = () => {
    if (progressTimer) {
      clearInterval(progressTimer);
      progressTimer = null;
    }
  };

  const renderPlaylist = () => {
    els.playlist.innerHTML = "";
    playlist.forEach((t, idx) => {
      const li = document.createElement("li");
      li.className = "track" + (idx === currentIndex ? " active" : "");
      li.dataset.index = String(idx);

      const img = document.createElement("img");
      img.className = "track__thumb";
      img.src = thumbURL(t.id);
      img.alt = "thumbnail";

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

      li.appendChild(img);
      li.appendChild(title);
      li.appendChild(remove);
      els.playlist.appendChild(li);
    });
  };

  // UI events
  els.play.addEventListener("click", togglePlay);
  els.prev.addEventListener("click", prevTrack);
  els.next.addEventListener("click", nextTrack);
  els.shuffle.addEventListener("click", toggleShuffle);
  els.repeat.addEventListener("click", cycleRepeatMode);
  els.mute.addEventListener("click", toggleMute);

  els.volume.addEventListener("input", (e) => setVolume(e.target.value));

  els.progress.addEventListener("input", (e) => {
    isSeeking = true;
    seekPercent(e.target.value);
  });
  els.progress.addEventListener("change", (e) => {
    isSeeking = false;
    seekPercent(e.target.value);
  });

  els.addUrl.addEventListener("click", async () => {
    const input = prompt("Masukkan URL YouTube atau ID video:");
    if (!input) return;
    const id = parseVideoId(input);
    if (!id) {
      alert("Tidak dapat mengenali ID video dari input.");
      return;
    }
    const title = prompt("Judul (opsional):") || undefined;
    await addTrack({ id, title });
  });

  els.importBtn.addEventListener("click", () => els.importFile.click());
  els.importFile.addEventListener("change", async (e) => {
    const file = e.target.files?.[0];
    if (file) {
      await importPlaylistFromFile(file);
      e.target.value = "";
    }
  });

  els.exportBtn.addEventListener("click", exportPlaylist);

  els.clear.addEventListener("click", () => {
    if (confirm("Bersihkan seluruh playlist?")) {
      clearPlaylist();
    }
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
        if (player) player.seekTo((player.getCurrentTime() || 0) + 5, true);
        break;
      case "ArrowLeft":
        if (player) player.seekTo(Math.max((player.getCurrentTime() || 0) - 5, 0), true);
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
})();