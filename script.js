// === STERNEN ===
const starsDiv = document.getElementById('stars');
for (let i = 0; i < 200; i++) {
    const star = document.createElement('div');
    star.className = 'star';
    star.style.width = star.style.height = Math.random() * 2 + 1 + 'px';
    star.style.left = Math.random() * 100 + '%';
    star.style.top = Math.random() * 100 + '%';
    star.style.animationDelay = Math.random() * 3 + 's';
    starsDiv.appendChild(star);
}

// === AUDIO SETUP ===
const audio = new Audio();
const audioCtx = new(window.AudioContext || window.webkitAudioContext)();
const analyser = audioCtx.createAnalyser();
analyser.fftSize = 256;
const sourceNode = audioCtx.createMediaElementSource(audio);

// EQ
const eqFilters = [];
const freqs = [60, 170, 500, 2000, 8000];
freqs.forEach(f => {
    const filter = audioCtx.createBiquadFilter();
    filter.type = 'peaking';
    filter.frequency.value = f;
    filter.Q.value = 1;
    filter.gain.value = 0;
    eqFilters.push(filter);
});
sourceNode.connect(eqFilters[0]);
for (let i = 0; i < eqFilters.length - 1; i++) eqFilters[i].connect(eqFilters[i + 1]);
eqFilters[eqFilters.length - 1].connect(analyser);
analyser.connect(audioCtx.destination);

// === STATE ===
let tracks = JSON.parse(localStorage.getItem("muplyPlaylist") || "[]");
let currentIndex = parseInt(localStorage.getItem("muplyIndex") || "0");
let shuffled = false;
let shuffleOrder = [];
let visMode = 0;

// === DOM ===
const trackListEl = document.getElementById('track-list');
const playPauseBtn = document.getElementById('btn-play-pause');
const nextBtn = document.getElementById('btn-next');
const prevBtn = document.getElementById('btn-prev');
const shuffleBtn = document.getElementById('btn-shuffle');
const seekSlider = document.getElementById('seek-slider');
const volumeSlider = document.getElementById('volume-slider');
const currentTimeEl = document.getElementById('current-time');
const durationEl = document.getElementById('duration');
const trackCountEl = document.getElementById('track-count');
const titleTicker = document.getElementById('title-ticker');
const themeBtn = document.getElementById('btn-theme');
const eqBtn = document.getElementById('btn-eq');
const eqContainer = document.getElementById('eq-container');

// === EQ TOGGLE ===
eqBtn.onclick = () => {
    eqContainer.classList.toggle('visible');
    eqBtn.classList.toggle('active');
};

// === EQ SLIDERS ===
document.querySelectorAll('.eq-slider input').forEach(slider => {
    const freq = parseInt(slider.dataset.freq);
    const filter = eqFilters.find(f => f.frequency.value === freq);
    slider.oninput = () => filter.gain.value = parseFloat(slider.value);
});

// === THEME ===
const savedTheme = localStorage.getItem('muplyTheme') || 'dark';
document.body.classList.toggle('light', savedTheme === 'light');
themeBtn.textContent = savedTheme === 'light' ? 'Light' : 'Dark';
themeBtn.onclick = () => {
    const isLight = document.body.classList.toggle('light');
    themeBtn.textContent = isLight ? 'Light' : 'Dark';
    localStorage.setItem('muplyTheme', isLight ? 'light' : 'dark');
};

// === TICKER ===
function updateTicker() {
    const list = shuffled ? shuffleOrder : tracks;
    const current = list[currentIndex];
    const title = current ? current.name : "Muply – CyberTerminal Music Player";
    titleTicker.textContent = title;
    titleTicker.style.animation = 'none';
    requestAnimationFrame(() => titleTicker.style.animation = 'ticker 20s linear infinite');
}

// === PLAYLIST RENDER ===
function renderPlaylist() {
    trackListEl.innerHTML = '';
    const list = shuffled ? shuffleOrder : tracks;
    list.forEach((t, i) => {
        const li = document.createElement('li');
        li.innerHTML = `<span>${t.name}</span><span class="delete-btn" onclick="event.stopPropagation(); deleteTrack(${i})">×</span>`;
        li.draggable = true;
        li.onclick = () => playTrack(i);
        if (i === currentIndex && !shuffled) li.classList.add('playing');
        li.ondragstart = e => e.dataTransfer.setData('text', i);
        li.ondragover = e => e.preventDefault();
        li.ondrop = e => {
            e.preventDefault();
            const from = parseInt(e.dataTransfer.getData('text'));
            [list[i], list[from]] = [list[from], list[i]];
            savePlaylist();
            renderPlaylist();
        };
        trackListEl.appendChild(li);
    });
    trackCountEl.textContent = tracks.length;
    updateTicker();
}

// === PLAYBACK ===
function playTrack(idx) {
    const list = shuffled ? shuffleOrder : tracks;
    if (!list[idx]) return;
    currentIndex = idx;
    audio.src = list[idx].url;
    audio.play().catch(() => {});
    audioCtx.resume();
    playPauseBtn.textContent = '❚❚';
    savePlaylist();
    renderPlaylist();
}

function togglePlay() {
    if (audio.paused) {
        audio.play();
        playPauseBtn.textContent = '❚❚';
    } else {
        audio.pause();
        playPauseBtn.textContent = '▶';
    }
}

function nextTrack() {
    const list = shuffled ? shuffleOrder : tracks;
    currentIndex = (currentIndex + 1) % list.length;
    playTrack(currentIndex);
}

function prevTrack() {
    const list = shuffled ? shuffleOrder : tracks;
    currentIndex = (currentIndex - 1 + list.length) % list.length;
    playTrack(currentIndex);
}

function toggleShuffle() {
    shuffled = !shuffled;
    shuffleBtn.style.color = shuffled ? '#ff0066' : '#00ff99';
    if (shuffled && shuffleOrder.length === 0) shuffleOrder = [...tracks].sort(() => Math.random() - 0.5);
    renderPlaylist();
}

function deleteTrack(idx) {
    const list = shuffled ? shuffleOrder : tracks;
    list.splice(idx, 1);
    if (currentIndex >= list.length) currentIndex = 0;
    savePlaylist();
    renderPlaylist();
    if (tracks.length === 0) {
        audio.pause();
        audio.src = "";
        updateTicker();
    } else playTrack(currentIndex);
}

// === FILE HANDLING ===
document.getElementById('btn-add-files').onclick = () => document.getElementById('file-input').click();
document.getElementById('btn-add-folder').onclick = () => document.getElementById('folder-input').click();
document.getElementById('file-input').onchange = handleFiles;
document.getElementById('folder-input').onchange = handleFiles;

function handleFiles(e) {
    const files = Array.from(e.target.files).filter(f => /audio|video/i.test(f.type));
    files.forEach(f => {
        tracks.push({ name: f.name.replace(/\.[^/.]+$/, ""), url: URL.createObjectURL(f) });
    });
    savePlaylist();
    renderPlaylist();
    if (tracks.length === files.length) playTrack(0);
}

// === SAVE / LOAD ===
document.getElementById('btn-save').onclick = () => {
    const data = JSON.stringify({ tracks, currentIndex, shuffled, shuffleOrder: shuffled ? shuffleOrder.map(t => tracks.indexOf(t)) : [] });
    const blob = new Blob([data], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `muply_${new Date().toISOString().slice(0,10)}.json`;
    a.click();
};

document.getElementById('btn-load').onclick = () => document.getElementById('load-playlist-input').click();
document.getElementById('load-playlist-input').onchange = e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
        try {
            const data = JSON.parse(ev.target.result);
            tracks = data.tracks || [];
            currentIndex = data.currentIndex || 0;
            shuffled = data.shuffled || false;
            shuffleOrder = data.shuffleOrder ? data.shuffleOrder.map(i => tracks[i]) : [];
            savePlaylist();
            renderPlaylist();
            if (tracks.length) playTrack(currentIndex);
        } catch { alert('Fehler beim Laden'); }
    };
    reader.readAsText(file);
};

function savePlaylist() {
    localStorage.setItem("muplyPlaylist", JSON.stringify(tracks));
    localStorage.setItem("muplyIndex", currentIndex);
}

// === PROGRESS ===
audio.onloadedmetadata = () => {
    seekSlider.max = audio.duration || 0;
    durationEl.textContent = formatTime(audio.duration || 0);
};
audio.ontimeupdate = () => {
    seekSlider.value = audio.currentTime;
    currentTimeEl.textContent = formatTime(audio.currentTime);
};
seekSlider.oninput = () => audio.currentTime = seekSlider.value;
volumeSlider.oninput = e => audio.volume = e.target.value;
audio.onended = nextTrack;

function formatTime(s) {
    const m = Math.floor(s / 60).toString().padStart(2, '0');
    const sec = Math.floor(s % 60).toString().padStart(2, '0');
    return `${m}:${sec}`;
}

// === VISUALIZER (inkl. 3D) ===
// === STERNEN ===
const starsDiv = document.getElementById('stars');
for (let i = 0; i < 200; i++) {
    const star = document.createElement('div');
    star.className = 'star';
    star.style.width = star.style.height = Math.random() * 2 + 1 + 'px';
    star.style.left = Math.random() * 100 + '%';
    star.style.top = Math.random() * 100 + '%';
    star.style.animationDelay = Math.random() * 3 + 's';
    starsDiv.appendChild(star);
}

// === AUDIO SETUP ===
const audio = new Audio();
const audioCtx = new(window.AudioContext || window.webkitAudioContext)();
const analyser = audioCtx.createAnalyser();
analyser.fftSize = 256;
const sourceNode = audioCtx.createMediaElementSource(audio);

// EQ
const eqFilters = [];
const freqs = [60, 170, 500, 2000, 8000];
freqs.forEach(f => {
    const filter = audioCtx.createBiquadFilter();
    filter.type = 'peaking';
    filter.frequency.value = f;
    filter.Q.value = 1;
    filter.gain.value = 0;
    eqFilters.push(filter);
});
sourceNode.connect(eqFilters[0]);
for (let i = 0; i < eqFilters.length - 1; i++) eqFilters[i].connect(eqFilters[i + 1]);
eqFilters[eqFilters.length - 1].connect(analyser);
analyser.connect(audioCtx.destination);

// === STATE ===
let tracks = JSON.parse(localStorage.getItem("muplyPlaylist") || "[]");
let currentIndex = parseInt(localStorage.getItem("muplyIndex") || "0");
let shuffled = false;
let shuffleOrder = [];
let visMode = 0;

// === DOM ===
const trackListEl = document.getElementById('track-list');
const playPauseBtn = document.getElementById('btn-play-pause');
const nextBtn = document.getElementById('btn-next');
const prevBtn = document.getElementById('btn-prev');
const shuffleBtn = document.getElementById('btn-shuffle');
const seekSlider = document.getElementById('seek-slider');
const volumeSlider = document.getElementById('volume-slider');
const currentTimeEl = document.getElementById('current-time');
const durationEl = document.getElementById('duration');
const trackCountEl = document.getElementById('track-count');
const titleTicker = document.getElementById('title-ticker');
const themeBtn = document.getElementById('btn-theme');
const eqBtn = document.getElementById('btn-eq');
const eqContainer = document.getElementById('eq-container');

// === EQ TOGGLE ===
eqBtn.onclick = () => {
    eqContainer.classList.toggle('visible');
    eqBtn.classList.toggle('active');
};

// === EQ SLIDERS ===
document.querySelectorAll('.eq-slider input').forEach(slider => {
    const freq = parseInt(slider.dataset.freq);
    const filter = eqFilters.find(f => f.frequency.value === freq);
    slider.oninput = () => filter.gain.value = parseFloat(slider.value);
});

// === THEME ===
const savedTheme = localStorage.getItem('muplyTheme') || 'dark';
document.body.classList.toggle('light', savedTheme === 'light');
themeBtn.textContent = savedTheme === 'light' ? 'Light' : 'Dark';
themeBtn.onclick = () => {
    const isLight = document.body.classList.toggle('light');
    themeBtn.textContent = isLight ? 'Light' : 'Dark';
    localStorage.setItem('muplyTheme', isLight ? 'light' : 'dark');
};

// === TICKER ===
function updateTicker() {
    const list = shuffled ? shuffleOrder : tracks;
    const current = list[currentIndex];
    const title = current ? current.name : "Muply – CyberTerminal Music Player";
    titleTicker.textContent = title;
    titleTicker.style.animation = 'none';
    requestAnimationFrame(() => titleTicker.style.animation = 'ticker 20s linear infinite');
}

// === PLAYLIST RENDER ===
function renderPlaylist() {
    trackListEl.innerHTML = '';
    const list = shuffled ? shuffleOrder : tracks;
    list.forEach((t, i) => {
        const li = document.createElement('li');
        li.innerHTML = `<span>${t.name}</span><span class="delete-btn" onclick="event.stopPropagation(); deleteTrack(${i})">×</span>`;
        li.draggable = true;
        li.onclick = () => playTrack(i);
        if (i === currentIndex && !shuffled) li.classList.add('playing');
        li.ondragstart = e => e.dataTransfer.setData('text', i);
        li.ondragover = e => e.preventDefault();
        li.ondrop = e => {
            e.preventDefault();
            const from = parseInt(e.dataTransfer.getData('text'));
            [list[i], list[from]] = [list[from], list[i]];
            savePlaylist();
            renderPlaylist();
        };
        trackListEl.appendChild(li);
    });
    trackCountEl.textContent = tracks.length;
    updateTicker();
}

// === PLAYBACK ===
function playTrack(idx) {
    const list = shuffled ? shuffleOrder : tracks;
    if (!list[idx]) return;
    currentIndex = idx;
    audio.src = list[idx].url;
    audio.play().catch(() => {});
    audioCtx.resume();
    playPauseBtn.textContent = '❚❚';
    savePlaylist();
    renderPlaylist();
}

function togglePlay() {
    if (audio.paused) {
        audio.play();
        playPauseBtn.textContent = '❚❚';
    } else {
        audio.pause();
        playPauseBtn.textContent = '▶';
    }
}

function nextTrack() {
    const list = shuffled ? shuffleOrder : tracks;
    currentIndex = (currentIndex + 1) % list.length;
    playTrack(currentIndex);
}

function prevTrack() {
    const list = shuffled ? shuffleOrder : tracks;
    currentIndex = (currentIndex - 1 + list.length) % list.length;
    playTrack(currentIndex);
}

function toggleShuffle() {
    shuffled = !shuffled;
    shuffleBtn.style.color = shuffled ? '#ff0066' : '#00ff99';
    if (shuffled && shuffleOrder.length === 0) shuffleOrder = [...tracks].sort(() => Math.random() - 0.5);
    renderPlaylist();
}

function deleteTrack(idx) {
    const list = shuffled ? shuffleOrder : tracks;
    list.splice(idx, 1);
    if (currentIndex >= list.length) currentIndex = 0;
    savePlaylist();
    renderPlaylist();
    if (tracks.length === 0) {
        audio.pause();
        audio.src = "";
        updateTicker();
    } else playTrack(currentIndex);
}

// === FILE HANDLING ===
document.getElementById('btn-add-files').onclick = () => document.getElementById('file-input').click();
document.getElementById('btn-add-folder').onclick = () => document.getElementById('folder-input').click();
document.getElementById('file-input').onchange = handleFiles;
document.getElementById('folder-input').onchange = handleFiles;

function handleFiles(e) {
    const files = Array.from(e.target.files).filter(f => /audio|video/i.test(f.type));
    files.forEach(f => {
        tracks.push({ name: f.name.replace(/\.[^/.]+$/, ""), url: URL.createObjectURL(f) });
    });
    savePlaylist();
    renderPlaylist();
    if (tracks.length === files.length) playTrack(0);
}

// === SAVE / LOAD ===
document.getElementById('btn-save').onclick = () => {
    const data = JSON.stringify({ tracks, currentIndex, shuffled, shuffleOrder: shuffled ? shuffleOrder.map(t => tracks.indexOf(t)) : [] });
    const blob = new Blob([data], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `muply_${new Date().toISOString().slice(0,10)}.json`;
    a.click();
};

document.getElementById('btn-load').onclick = () => document.getElementById('load-playlist-input').click();
document.getElementById('load-playlist-input').onchange = e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
        try {
            const data = JSON.parse(ev.target.result);
            tracks = data.tracks || [];
            currentIndex = data.currentIndex || 0;
            shuffled = data.shuffled || false;
            shuffleOrder = data.shuffleOrder ? data.shuffleOrder.map(i => tracks[i]) : [];
            savePlaylist();
            renderPlaylist();
            if (tracks.length) playTrack(currentIndex);
        } catch { alert('Fehler beim Laden'); }
    };
    reader.readAsText(file);
};

function savePlaylist() {
    localStorage.setItem("muplyPlaylist", JSON.stringify(tracks));
    localStorage.setItem("muplyIndex", currentIndex);
}

// === PROGRESS ===
audio.onloadedmetadata = () => {
    seekSlider.max = audio.duration || 0;
    durationEl.textContent = formatTime(audio.duration || 0);
};
audio.ontimeupdate = () => {
    seekSlider.value = audio.currentTime;
    currentTimeEl.textContent = formatTime(audio.currentTime);
};
seekSlider.oninput = () => audio.currentTime = seekSlider.value;
volumeSlider.oninput = e => audio.volume = e.target.value;
audio.onended = nextTrack;

function formatTime(s) {
    const m = Math.floor(s / 60).toString().padStart(2, '0');
    const sec = Math.floor(s % 60).toString().padStart(2, '0');
    return `${m}:${sec}`;
}

// === VISUALIZER (inkl. 3D) ===
// (Der komplette Visualizer-Code aus der letzten Version – BARS bis 3D EQ BARS – bleibt hier gleich)

// === EVENTS ===
playPauseBtn.onclick = togglePlay;
nextBtn.onclick = nextTrack;
prevBtn.onclick = prevTrack;
shuffleBtn.onclick = toggleShuffle;
document.querySelectorAll('.vis-tab').forEach(tab => {
    tab.onclick = () => {
        document.querySelectorAll('.vis-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        setVis(parseInt(tab.dataset.vis));
    };
});

// === START ===
drawVisualizer();
if (tracks.length) {
    renderPlaylist();
    playTrack(currentIndex);
} else {
    updateTicker();
}
// === EVENTS ===
playPauseBtn.onclick = togglePlay;
nextBtn.onclick = nextTrack;
prevBtn.onclick = prevTrack;
shuffleBtn.onclick = toggleShuffle;
document.querySelectorAll('.vis-tab').forEach(tab => {
    tab.onclick = () => {
        document.querySelectorAll('.vis-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        setVis(parseInt(tab.dataset.vis));
    };
});

// === START ===
drawVisualizer();
if (tracks.length) {
    renderPlaylist();
    playTrack(currentIndex);
} else {
    updateTicker();
}