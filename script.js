import { gsap } from 'gsap';
import { initAudio, resumeAudioContext, playSound, playMusic } from './audio.js';
import { initThree } from './background.js';
import { storeOriginalTexts, setupLanguageSelector } from './translation.js';
import { switchMenu, fadeInMenu } from './ui.js';
import { player } from './state.js';
import { generateChannels } from './channel.js';
import { generateUsers } from './user.js';
import { sendMessage } from './message.js';
import { setupAdminPanel } from './admin.js';
import { setupSettingsPanel } from './settings.js';
import { initCommunity, showCommunityScreen, hideCommunityScreen } from './community.js';
import { initMods, showModsScreen, hideModsScreen } from './mods.js';

// Helper for safe event listeners to prevent null errors
function safeAddListener(id, event, handler) {
    const el = document.getElementById(id);
    if (el) {
        el.addEventListener(event, handler);
    } else {
        console.warn(`Element with id '${id}' not found for event '${event}'`);
    }
}

// --- AUDIO SETUP ---
// removed initAudio(), loadSound(), playSound(), playMusic() -> moved to audio.js
// removed audioContext, musicSource, musicBuffer, sounds -> moved to audio.js

// Need to start audio on user interaction
document.body.addEventListener('click', resumeAudioContext, { once: true });


// --- LANGUAGE & TRANSLATION ---
// removed currentLanguage, translations, originalTexts -> moved to translation.js
// removed storeOriginalTexts(), translateUI(), applyTranslations(), setupLanguageSelector() -> moved to translation.js


// --- 3D BACKGROUND ---
// removed scene, camera, renderer, particles -> moved to background.js
// removed initThree(), animate(), onWindowResize() -> moved to background.js


// --- UI TRANSITIONS ---
// removed transitionOverlay -> functionality moved inside ui.js
// removed screenTransition(), fadeOutMenu(), fadeInMenu(), switchMenu() -> moved to ui.js


// --- CHAT LOGIC ---
// removed participants, channels, player, chatSimulationTimeout -> moved to chat.js
// removed all chat functions -> moved to chat.js


// --- MAIN ANIMATION LOGIC ---
function startIntro() {
    const splashScreen = document.getElementById('splash-screen');
    const mainMenu = document.getElementById('main-menu');

    if (!splashScreen || !mainMenu) {
        console.error("Critical UI elements missing");
        return;
    }

    gsap.set([mainMenu, document.getElementById('gamemode-menu'), document.getElementById('customize-menu')], { 
        display: 'none',
        opacity: 0,
        pointerEvents: 'none'
    });

    const splashTitle = document.querySelector('#splash-screen h1');

    const tl = gsap.timeline();

    tl.to(splashTitle, {
        opacity: 1,
        duration: 0.1,
        onStart: () => playSound('splash')
    })
    .to(splashTitle, {
        duration: 2.5, // Hold splash
    })
    .to(splashScreen, {
        opacity: 0,
        duration: 1.5,
        onComplete: () => {
            splashScreen.style.display = 'none';
            const mainMenu = document.getElementById('main-menu');
            if(mainMenu) {
                mainMenu.style.opacity = 0; 
                mainMenu.style.pointerEvents = 'none';
                fadeInMenu(mainMenu);
            }
            playMusic();
        }
    });
}


// --- EVENT LISTENERS ---
function setupEventListeners() {
    const mainMenu = document.getElementById('main-menu');
    const gamemodeMenu = document.getElementById('gamemode-menu');
    const customizeMenu = document.getElementById('customize-menu');
    const chatScreen = document.getElementById('chat-screen');
    const communityScreen = document.getElementById('community-screen');
    const modsScreen = document.getElementById('mods-screen');

    // Clicks with sound
    document.querySelectorAll('button:not(.disabled):not(.no-sound)').forEach(button => {
        button.addEventListener('click', () => {
            playSound('click');
        });
    });

    // Main Menu -> Gamemode Menu
    safeAddListener('start-game-btn', 'click', () => {
        switchMenu(mainMenu, gamemodeMenu, true);
    });

    // Main Menu -> Community
    safeAddListener('community-btn', 'click', () => {
        switchMenu(mainMenu, communityScreen, true, showCommunityScreen, hideCommunityScreen);
    });

    // Community -> Main Menu
    safeAddListener('community-back-btn', 'click', () => {
        switchMenu(communityScreen, mainMenu, true, hideCommunityScreen);
    });

    // Gamemode Menu -> Customize Menu
    safeAddListener('sandbox-btn', 'click', () => {
        switchMenu(gamemodeMenu, customizeMenu);
    });

    // Gamemode Menu -> Main Menu
    safeAddListener('gamemode-back-btn', 'click', () => {
        switchMenu(gamemodeMenu, mainMenu, true);
    });

    // Customize Menu -> Gamemode Menu
    safeAddListener('customize-back-btn', 'click', () => {
        switchMenu(customizeMenu, gamemodeMenu);
    });

    // Start Custom Game
    safeAddListener('start-custom-game-btn', 'click', async () => {
        const usernameInput = document.getElementById('username-input');
        
        const username = usernameInput ? usernameInput.value.trim() : "Admin";
        if (username) {
            player.name = username;
        } else {
            player.name = "Admin"; // Fallback
        }
        
        const loadingScreen = document.getElementById('loading-screen');
        if (loadingScreen) loadingScreen.style.display = 'flex';

        await generateUsers();
        await generateChannels();
        
        if (loadingScreen) loadingScreen.style.display = 'none';
        
        switchMenu(customizeMenu, chatScreen, true);
    });

    // Chat messaging
    safeAddListener('send-message-btn', 'click', sendMessage);
    safeAddListener('chat-input', 'keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            sendMessage();
        }
    });

    // Main Menu -> Mods (ENABLE IT)
    safeAddListener('mods-btn', 'click', () => {
        switchMenu(mainMenu, modsScreen, true, showModsScreen, hideModsScreen);
    });

    // Mods -> Main Menu
    safeAddListener('mods-back-btn', 'click', () => {
        switchMenu(modsScreen, mainMenu, true, hideModsScreen);
    });
}


// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
    initAudio();
    initThree();
    storeOriginalTexts();
    setupLanguageSelector();
    startIntro();
    setupEventListeners();
    setupAdminPanel();
    setupSettingsPanel();
    initCommunity();
    initMods();
});