let audioContext;
let musicSource;
let musicBuffer;
const sounds = {};

export function initAudio() {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    loadSound('splash_sound.mp3', 'splash');
    loadSound('menu_music.mp3', 'music');
    loadSound('/Click_Sound.mp3', 'click');
}

export function resumeAudioContext() {
    if (audioContext && audioContext.state === 'suspended') {
        audioContext.resume();
    }
}

async function loadSound(url, name) {
    if (!audioContext) return;
    try {
        const response = await fetch(url);
        const arrayBuffer = await response.arrayBuffer();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        sounds[name] = audioBuffer;
        if (name === 'music') {
            musicBuffer = audioBuffer;
        }
    } catch (error) {
        console.error(`Error loading sound ${name}:`, error);
    }
}

export function playSound(name) {
    if (!sounds[name] || !audioContext) return;
    if (audioContext.state === 'suspended') {
        audioContext.resume();
    }
    const source = audioContext.createBufferSource();
    source.buffer = sounds[name];
    source.connect(audioContext.destination);
    source.start(0);
}

export function playMusic() {
    if (!musicBuffer || !audioContext) return;
    if (audioContext.state === 'suspended') {
        audioContext.resume();
    }
    if (musicSource) {
        musicSource.stop();
    }
    musicSource = audioContext.createBufferSource();
    musicSource.buffer = musicBuffer;
    musicSource.loop = true;
    musicSource.connect(audioContext.destination);
    musicSource.start(0);
}