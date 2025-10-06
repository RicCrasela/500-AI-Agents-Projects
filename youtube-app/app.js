/**
 * YouTube Player App with Search + Upload (Data API v3).
 * - Adds videos by URL or ID
 * - Persists playlist via localStorage
 * - Import/Export playlist (JSON)
 * - Search videos using API key (stored in localStorage)
 * - Upload video using OAuth 2.0 (Client ID required)
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
  let apiKey = "";
  let clientId = localStorage.getItem("youtube_client_id") || "";
  let isSignedIn = false;

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
    searchQuery: document.getElementById("search-query"),
    apiKeyInput: document.getElementById("api-key"),
    saveKey: document.getElementById("save-key"),
    searchBtn: document.getElementById("search-btn"),
    searchResults: document.getElementById("search-results"),
    clientIdInput: document.getElementById("client-id"),
    saveClient: document.getElementById("save-client"),
    authBtn: document.getElementById("auth"),
    signOutBtn: document.getElementById("signout"),
    videoFile: document.getElementById("video-file"),
    videoTitle: document.getElementById("video-title"),
    videoDesc: document.getElementById("video-desc"),
    videoPrivacy: document.getElementById("video-privacy"),
    uploadBtn: document.getElementById("upload-btn"),
    uploadStatus: document.getElementById("upload-status"),
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
    // Load settings first to apply defaults
    loadSettings();
    applyTheme(settings.theme);
    const initialVol = Number.isFinite(Number(settings.defaultVolume)) ? Number(settings.defaultVolume) : Number(els.volume.value);
    els.volume.value = String(Math.max(0, Math.min(100, initialVol)));
    setVolume(els.volume.value);

    apiKey = localStorage.getItem("youtube_api_key") || "";
    if (apiKey) els.apiKeyInput.value = apiKey;

    // Remember browser URL
    if (settings.rememberBrowserURL) {
      const savedURL = localStorage.getItem("yt_browser_url");
      if (savedURL) {
        const input = document.getElementById("browser-url");
        const iframe = document.getElementById("webview");
        if (input) input.value = savedURL;
        if (iframe) iframe.src = savedURL;
      }
    }

    loadPersistedPlaylist();
    renderPlaylist();
    // Init GAPI after iframe API ready to avoid race on global callbacks
    initGapiClient();
    // Prefill upload privacy default
    if (settings.defaultPrivacy) {
      els.videoPrivacy.value = settings.defaultPrivacy;
    }
    // Prefill settings UI
    populateSettingsUI();
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

  // Search
  const searchYouTube = async (query) => {
    const key = apiKey || els.apiKeyInput.value.trim();
    if (!key) {
      alert("Masukkan YouTube API Key terlebih dahulu.");
      return;
    }
    const params = new URLSearchParams({
      key,
      q: query,
      part: "snippet",
      type: "video",
      maxResults: String(settings.maxResults || 20),
      order: settings.order || "relevance",
      regionCode: settings.regionCode || undefined,
    });
    // Remove undefined params
    Array.from(params.keys()).forEach(k => {
      if (params.get(k) === "undefined") params.delete(k);
    });
    const url = `https://www.googleapis.com/youtube/v3/search?${params.toString()}`;
    try {
      els.searchResults.innerHTML = "";
      const res = await fetch(url);
      if (!res.ok) {
        const errText = await res.text();
        throw new Error(errText || "Request gagal");
      }
      const data = await res.json();
      const items = Array.isArray(data.items) ? data.items : [];
      renderSearchResults(items);
    } catch (e) {
      alert("Gagal mencari: " + (e?.message || "unknown error"));
    }
  };

  const renderSearchResults = (items) => {
    els.searchResults.innerHTML = "";
    items.forEach((item) => {
      const id = item.id?.videoId;
      const sn = item.snippet || {};
      if (!id) return;

      const li = document.createElement("li");
      li.className = "result";

      const img = document.createElement("img");
      img.className = "result__thumb";
      img.src = sn.thumbnails?.medium?.url || thumbURL(id);
      img.alt = "thumbnail";

      const meta = document.createElement("div");
      meta.className = "result__meta";

      const title = document.createElement("div");
      title.className = "result__title";
      title.textContent = sn.title || id;

      const channel = document.createElement("div");
      channel.className = "result__channel";
      channel.textContent = sn.channelTitle || "Tidak diketahui";

      const addBtn = document.createElement("button");
      addBtn.textContent = "➕ Tambah";
      addBtn.addEventListener("click", async () => {
        await addTrack({ id, title: sn.title });
      });

      meta.appendChild(title);
      meta.appendChild(channel);
      li.appendChild(img);
      li.appendChild(meta);
      li.appendChild(addBtn);
      els.searchResults.appendChild(li);
    });
  };

  // Upload (OAuth)
  const initGapiClient = () => {
    if (!window.gapi) return;
    gapi.load("client:auth2", async () => {
      try {
        await gapi.client.init({
          apiKey: apiKey || els.apiKeyInput.value.trim() || undefined,
          clientId: clientId || undefined,
          scope: "https://www.googleapis.com/auth/youtube.upload",
          discoveryDocs: ["https://www.googleapis.com/discovery/v1/apis/youtube/v3/rest"],
        });
        const auth = gapi.auth2.getAuthInstance();
        isSignedIn = auth.isSignedIn.get();
        updateAuthUI();
        auth.isSignedIn.listen((val) => {
          isSignedIn = val;
          updateAuthUI();
        });
      } catch (e) {
        // Initialization may fail until clientId is set
      }
    });
  };

  const updateAuthUI = () => {
    els.authBtn.textContent = isSignedIn ? "✅ Signed in" : "🔐 Sign in";
    els.authBtn.disabled = !clientId;
    els.signOutBtn.disabled = !isSignedIn;
    els.uploadBtn.disabled = !isSignedIn;
  };

  const signIn = async () => {
    if (!clientId) {
      alert("Masukkan Client ID terlebih dahulu.");
      return;
    }
    try {
      await gapi.auth2.getAuthInstance().signIn();
    } catch (e) {
      alert("Gagal sign in: " + (e?.error || e?.message || "unknown"));
    }
  };

  const signOut = async () => {
    try {
      await gapi.auth2.getAuthInstance().signOut();
    } catch {
      // ignore
    }
  };

  const uploadVideo = async () => {
    const file = els.videoFile.files?.[0];
    if (!file) {
      alert("Pilih file video terlebih dahulu.");
      return;
    }
    if (!isSignedIn) {
      alert("Silakan sign in terlebih dahulu.");
      return;
    }
    const title = els.videoTitle.value.trim() || file.name;
    const description = els.videoDesc.value.trim();
    const privacyStatus = els.videoPrivacy.value || "private";

    els.uploadStatus.textContent = "Memulai upload (resumable)...";

    // Step 1: Create a resumable upload session
    const token = gapi.client.getToken()?.access_token;
    if (!token) {
      alert("Token tidak tersedia. Pastikan sudah sign in.");
      return;
    }

    const metadata = {
      snippet: { title, description },
      status: { privacyStatus },
    };

    try {
      const startRes = await fetch("https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json; charset=UTF-8",
          "X-Upload-Content-Length": String(file.size),
          "X-Upload-Content-Type": file.type || "video/*",
        },
        body: JSON.stringify(metadata),
      });

      if (!startRes.ok) {
        const text = await startRes.text();
        throw new Error(text || "Gagal membuat sesi upload");
      }

      const sessionUrl = startRes.headers.get("Location");
      if (!sessionUrl) throw new Error("Tidak ada URL sesi upload");

      els.uploadStatus.textContent = "Mengunggah video...";

      // Step 2: Upload file bytes
      const uploadRes = await fetch(sessionUrl, {
        method: "PUT",
        headers: {
          "Content-Type": file.type || "video/*",
          "Content-Length": String(file.size),
        },
        body: file,
      });

      if (!uploadRes.ok) {
        const text = await uploadRes.text();
        throw new Error(text || "Upload gagal");
      }

      const result = await uploadRes.json();
      els.uploadStatus.textContent = `Selesai. Video ID: ${result.id || "(unknown)"}`;

      // Optional: add to playlist immediately
      if (result.id) {
        await addTrack({ id: result.id, title });
      }
    } catch (e) {
      els.uploadStatus.textContent = "Error: " + (e?.message || "unknown");
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

  // Search UI
  els.saveKey.addEventListener("click", () => {
    const val = els.apiKeyInput.value.trim();
    if (!val) {
      alert("Isi API key terlebih dahulu.");
      return;
    }
    apiKey = val;
    localStorage.setItem("youtube_api_key", apiKey);
    alert("API key disimpan.");
    initGapiClient(); // re-init dengan API key
  });

  els.searchBtn.addEventListener("click", () => {
    const q = els.searchQuery.value.trim();
    if (!q) return;
    searchYouTube(q);
  });

  // Upload UI
  els.saveClient.addEventListener("click", () => {
    const val = els.clientIdInput.value.trim();
    if (!val) {
      alert("Isi Client ID terlebih dahulu.");
      return;
    }
    clientId = val;
    localStorage.setItem("youtube_client_id", clientId);
    initGapiClient();
    updateAuthUI();
    alert("Client ID disimpan.");
  });

  els.authBtn.addEventListener("click", signIn);
  els.signOutBtn.addEventListener("click", signOut);
  els.uploadBtn.addEventListener("click", uploadVideo);

  // Profile UI refs
  const profile = {
    avatar: document.getElementById("profile-avatar"),
    name: document.getElementById("profile-name"),
    email: document.getElementById("profile-email"),
    channel: document.getElementById("profile-channel"),
    subs: document.getElementById("stat-subs"),
    videos: document.getElementById("stat-videos"),
    views: document.getElementById("stat-views"),
    refresh: document.getElementById("refresh-profile"),
    openChannel: document.getElementById("open-channel"),
    signout2: document.getElementById("signout-2"),
  };

  const formatNumber = (n) => {
    if (n == null) return "—";
    const num = Number(n);
    if (!Number.isFinite(num)) return String(n);
    return Intl.NumberFormat("id-ID", { notation: "compact" }).format(num);
  };

  const fetchProfile = async () => {
    if (!gapi?.client) return;
    const auth = gapi.auth2?.getAuthInstance?.();
    if (!auth || !auth.isSignedIn.get()) {
      setProfileSignedOut();
      return;
    }
    // Basic profile from Google user
    const user = auth.currentUser.get();
    const basic = user.getBasicProfile?.();
    profile.name.textContent = basic?.getName?.() || "Pengguna";
    profile.email.textContent = basic?.getEmail?.() || "—";
    const imageUrl = basic?.getImageUrl?.();
    if (imageUrl) profile.avatar.src = imageUrl;

    // Channel stats
    try {
      const res = await gapi.client.youtube.channels.list({
        mine: true,
        part: "snippet,statistics",
      });
      const item = res.result.items?.[0];
      if (item) {
        const title = item.snippet?.title || "Channel";
        const id = item.id;
        profile.channel.textContent = `Channel: ${title}`;
        profile.subs.textContent = formatNumber(item.statistics?.subscriberCount);
        profile.videos.textContent = formatNumber(item.statistics?.videoCount);
        profile.views.textContent = formatNumber(item.statistics?.viewCount);
        profile.openChannel.disabled = !id;
        if (id) {
          profile.openChannel.onclick = () =>
            window.open(`https://www.youtube.com/channel/${id}`, "_blank", "noopener,noreferrer");
        }
      } else {
        profile.channel.textContent = "Channel: —";
        profile.subs.textContent = "—";
        profile.videos.textContent = "—";
        profile.views.textContent = "—";
        profile.openChannel.disabled = true;
      }
      profile.signout2.disabled = false;
    } catch {
      // If quota or permission missing
      profile.channel.textContent = "Channel: (tidak dapat memuat)";
      profile.openChannel.disabled = true;
    }
  };

  const setProfileSignedOut = () => {
    profile.name.textContent = "Belum masuk";
    profile.email.textContent = "—";
    profile.channel.textContent = "Channel: —";
    profile.subs.textContent = "—";
    profile.videos.textContent = "—";
    profile.views.textContent = "—";
    profile.avatar.removeAttribute("src");
    profile.openChannel.disabled = true;
    profile.signout2.disabled = true;
  };

  profile.refresh.addEventListener("click", fetchProfile);
  profile.signout2.addEventListener("click", signOut);

  // In-app browser UI
  const webview = document.getElementById("webview");
  const browserUrl = document.getElementById("browser-url");
  const rememberURL = () => {
    if (settings.rememberBrowserURL) {
      localStorage.setItem("yt_browser_url", (browserUrl.value || "").trim());
    }
  };
  document.getElementById("open-iframe").addEventListener("click", () => {
    const url = (browserUrl.value || "").trim() || "https://m.youtube.com/";
    webview.src = url;
    rememberURL();
  });
  document.getElementById("open-tab").addEventListener("click", () => {
    const url = (browserUrl.value || "").trim() || "https://m.youtube.com/";
    window.open(url, "_blank", "noopener,noreferrer");
    rememberURL();
  });

  // Smooth scroll + menu active state
  const menu = document.getElementById("menu");
  if (menu) {
    const items = Array.from(menu.querySelectorAll(".menu__item")).filter(a => a.hash);
    const sections = items.map(a => document.querySelector(a.hash)).filter(Boolean);

    const setActive = (hash) => {
      items.forEach(a => a.classList.toggle("active", a.hash === hash));
    };

    items.forEach((a) => {
      a.addEventListener("click", (e) => {
        if (!a.hash) return;
        const target = document.querySelector(a.hash);
        if (target) {
          e.preventDefault();
          target.scrollIntoView({ behavior: "smooth", block: "start" });
          setActive(a.hash);
        }
      });
    });

    const onScroll = () => {
      const y = window.scrollY + 100;
      let activeHash = items[0]?.hash;
      sections.forEach((sec, idx) => {
        const rect = sec.getBoundingClientRect();
        const top = rect.top + window.scrollY;
        if (y >= top) {
          activeHash = items[idx].hash;
        }
      });
      setActive(activeHash);
    };
    window.addEventListener("scroll", onScroll);
    onScroll();
  }

  // Keyboard shortcuts
  window.addEventListener("keydown", (e) => {
    if (!settings.enableHotkeys) return;
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

  // Settings
  const defaultSettings = {
    theme: "dark",
    defaultVolume: 80,
    enableHotkeys: true,
    regionCode: "",
    order: "relevance",
    maxResults: 20,
    defaultPrivacy: "private",
    rememberBrowserURL: false,
  };
  let settings = { ...defaultSettings };

  const loadSettings = () => {
    try {
      const raw = localStorage.getItem("yt_app_settings");
      if (!raw) return;
      const data = JSON.parse(raw);
      if (data && typeof data === "object") {
        settings = { ...settings, ...data };
      }
    } catch {
      // ignore
    }
  };

  const saveSettings = () => {
    localStorage.setItem("yt_app_settings", JSON.stringify(settings));
  };

  const applyTheme = (theme) => {
    const t = theme || "dark";
    if (t === "light") {
      document.body.setAttribute("data-theme", "light");
    } else if (t === "system") {
      const prefersLight = window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches;
      document.body.setAttribute("data-theme", prefersLight ? "light" : "");
      if (!prefersLight) document.body.removeAttribute("data-theme");
    } else {
      document.body.removeAttribute("