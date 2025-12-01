import { participants } from './state.js';
import { renderParticipants } from './user.js';
import { showModal, hideModal } from './ui.js';

let settingsPanel;
let closeBtn;
let openBtn;

let editingUser = null; // null means "All Users"

export function setupSettingsPanel() {
    settingsPanel = document.getElementById('settings-panel-modal');
    closeBtn = document.getElementById('close-settings-panel-btn');
    openBtn = document.getElementById('settings-panel-btn');

    if (openBtn) openBtn.addEventListener('click', showSettingsPanel);
    if (closeBtn) closeBtn.addEventListener('click', hideSettingsPanel);
    if (settingsPanel) {
        settingsPanel.addEventListener('click', (e) => {
            if (e.target === settingsPanel) {
                hideSettingsPanel();
            }
        });
    }
}

function showSettingsPanel() {
    renderUserSelection();
    showModal(settingsPanel);
}

function hideSettingsPanel() {
    hideModal(settingsPanel);
}

function renderUserSelection() {
    const content = document.getElementById('settings-panel-content');
    const eligibleUsers = participants.filter(p => p.role !== 'Admin');

    content.innerHTML = `
        <div class="settings-user-selection">
            <h3>Select Participant to Configure</h3>
            <button class="settings-user-btn all-users-btn" data-user="all">
                <span class="settings-user-icon">👥</span>
                <span class="settings-user-name">All Users</span>
            </button>
            <div class="settings-user-list">
                ${eligibleUsers.map(user => `
                    <button class="settings-user-btn" data-user="${user.name}">
                        <img src="${user.avatar}" alt="${user.name}">
                        <span class="settings-user-name">${user.name}</span>
                        <span class="settings-user-traits">${user.personality} • ${user.mood}</span>
                    </button>
                `).join('')}
            </div>
        </div>
    `;

    content.querySelectorAll('.settings-user-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const userName = btn.dataset.user;
            editingUser = userName === 'all' ? null : userName;
            renderSettingsEditor();
        });
    });
}

function renderSettingsEditor() {
    const content = document.getElementById('settings-panel-content');
    const isAllUsers = editingUser === null;
    const user = isAllUsers ? null : participants.find(p => p.name === editingUser);

    const currentValues = isAllUsers ? {
        personality: 'Mixed',
        mood: 'neutral',
        communicationStyle: 'casual',
        ruleBreaker: false,
        conflictProne: false,
        activityLevel: 0.5,
        messageDelay: 1.0,
        responseProbability: 0.5,
        memoryRetention: 0.5,
        learningEnabled: false
    } : user;

    content.innerHTML = `
        <div class="settings-editor">
            <div class="settings-header">
                <button class="back-btn settings-back">← Back</button>
                <h3>Configure: ${isAllUsers ? 'All Users' : editingUser}</h3>
            </div>
            
            <div class="settings-form">
                <div class="setting-group">
                    <label>Personality Type</label>
                    <select id="setting-personality" class="setting-select">
                        <option value="Gamer" ${currentValues.personality === 'Gamer' ? 'selected' : ''}>Gamer</option>
                        <option value="Tech Enthusiast" ${currentValues.personality === 'Tech Enthusiast' ? 'selected' : ''}>Tech Enthusiast</option>
                        <option value="Meme Lord" ${currentValues.personality === 'Meme Lord' ? 'selected' : ''}>Meme Lord</option>
                        <option value="Casual Chatter" ${currentValues.personality === 'Casual Chatter' ? 'selected' : ''}>Casual Chatter</option>
                        <option value="Helpful Senior Member" ${currentValues.personality === 'Helpful Senior Member' ? 'selected' : ''}>Helpful Senior Member</option>
                        <option value="Artist" ${currentValues.personality === 'Artist' ? 'selected' : ''}>Artist</option>
                        <option value="Musician" ${currentValues.personality === 'Musician' ? 'selected' : ''}>Musician</option>
                        <option value="Programmer" ${currentValues.personality === 'Programmer' ? 'selected' : ''}>Programmer</option>
                        <option value="Shitposter" ${currentValues.personality === 'Shitposter' ? 'selected' : ''}>Shitposter</option>
                        <option value="Newbie" ${currentValues.personality === 'Newbie' ? 'selected' : ''}>Newbie</option>
                        <option value="Know-it-all" ${currentValues.personality === 'Know-it-all' ? 'selected' : ''}>Know-it-all</option>
                        <option value="Troll" ${currentValues.personality === 'Troll' ? 'selected' : ''}>Troll</option>
                        <option value="Drama Queen" ${currentValues.personality === 'Drama Queen' ? 'selected' : ''}>Drama Queen</option>
                    </select>
                </div>

                <div class="setting-group">
                    <label>Current Mood</label>
                    <select id="setting-mood" class="setting-select">
                        <option value="happy" ${currentValues.mood === 'happy' ? 'selected' : ''}>😊 Happy</option>
                        <option value="neutral" ${currentValues.mood === 'neutral' ? 'selected' : ''}>😐 Neutral</option>
                        <option value="angry" ${currentValues.mood === 'angry' ? 'selected' : ''}>😠 Angry</option>
                        <option value="sad" ${currentValues.mood === 'sad' ? 'selected' : ''}>😢 Sad</option>
                        <option value="excited" ${currentValues.mood === 'excited' ? 'selected' : ''}>🤩 Excited</option>
                        <option value="bored" ${currentValues.mood === 'bored' ? 'selected' : ''}>😑 Bored</option>
                        <option value="annoyed" ${currentValues.mood === 'annoyed' ? 'selected' : ''}>😒 Annoyed</option>
                        <option value="friendly" ${currentValues.mood === 'friendly' ? 'selected' : ''}>😄 Friendly</option>
                        <option value="hostile" ${currentValues.mood === 'hostile' ? 'selected' : ''}>😤 Hostile</option>
                    </select>
                </div>

                <div class="setting-group">
                    <label>Communication Style</label>
                    <select id="setting-style" class="setting-select">
                        <option value="casual" ${currentValues.communicationStyle === 'casual' ? 'selected' : ''}>Casual</option>
                        <option value="formal" ${currentValues.communicationStyle === 'formal' ? 'selected' : ''}>Formal</option>
                        <option value="sarcastic" ${currentValues.communicationStyle === 'sarcastic' ? 'selected' : ''}>Sarcastic</option>
                        <option value="friendly" ${currentValues.communicationStyle === 'friendly' ? 'selected' : ''}>Friendly</option>
                        <option value="aggressive" ${currentValues.communicationStyle === 'aggressive' ? 'selected' : ''}>Aggressive</option>
                        <option value="passive" ${currentValues.communicationStyle === 'passive' ? 'selected' : ''}>Passive</option>
                        <option value="humorous" ${currentValues.communicationStyle === 'humorous' ? 'selected' : ''}>Humorous</option>
                        <option value="serious" ${currentValues.communicationStyle === 'serious' ? 'selected' : ''}>Serious</option>
                    </select>
                </div>

                <div class="setting-group">
                    <label>Activity Level (${Math.round(currentValues.activityLevel * 100)}%)</label>
                    <input type="range" id="setting-activity" class="setting-slider" min="0" max="100" value="${Math.round(currentValues.activityLevel * 100)}">
                    <span class="slider-value">${Math.round(currentValues.activityLevel * 100)}%</span>
                </div>

                <div class="setting-group">
                    <label>Message Delay Multiplier (${(currentValues.messageDelay || 1.0).toFixed(1)}x)</label>
                    <input type="range" id="setting-delay" class="setting-slider" min="0" max="30" step="1" value="${Math.round((currentValues.messageDelay || 1.0) * 10)}">
                    <span class="slider-value">${(currentValues.messageDelay || 1.0).toFixed(1)}x</span>
                </div>

                <div class="setting-group">
                    <label>Response Probability (${Math.round((currentValues.responseProbability || 0.5) * 100)}%)</label>
                    <input type="range" id="setting-response-prob" class="setting-slider" min="0" max="100" value="${Math.round((currentValues.responseProbability || 0.5) * 100)}">
                    <span class="slider-value">${Math.round((currentValues.responseProbability || 0.5) * 100)}%</span>
                </div>

                <div class="setting-group">
                    <label>Memory Retention (${Math.round((currentValues.memoryRetention || 0.5) * 100)}%)</label>
                    <input type="range" id="setting-memory" class="setting-slider" min="0" max="100" value="${Math.round((currentValues.memoryRetention || 0.5) * 100)}">
                    <span class="slider-value">${Math.round((currentValues.memoryRetention || 0.5) * 100)}%</span>
                </div>

                <div class="setting-group">
                    <label>Topic Interests</label>
                    <input type="text" id="setting-interests" class="admin-input" placeholder="e.g., gaming, tech, music" value="${currentValues.topicInterests || ''}">
                </div>

                <div class="setting-group">
                    <label>Conflict Triggers</label>
                    <input type="text" id="setting-triggers" class="admin-input" placeholder="e.g., politics, religion" value="${currentValues.conflictTriggers || ''}">
                </div>

                <div class="setting-group checkbox-group">
                    <label class="checkbox-label">
                        <input type="checkbox" id="setting-rulebreaker" ${currentValues.ruleBreaker ? 'checked' : ''}>
                        <span>Rule Breaker (may spam, use caps, etc.)</span>
                    </label>
                </div>

                <div class="setting-group checkbox-group">
                    <label class="checkbox-label">
                        <input type="checkbox" id="setting-conflict" ${currentValues.conflictProne ? 'checked' : ''}>
                        <span>Conflict Prone (starts arguments)</span>
                    </label>
                </div>

                <div class="setting-group checkbox-group">
                    <label class="checkbox-label">
                        <input type="checkbox" id="setting-learning" ${currentValues.learningEnabled ? 'checked' : ''}>
                        <span>Learning Enabled (adapts over time)</span>
                    </label>
                </div>

                <div class="setting-group checkbox-group">
                    <label class="checkbox-label">
                        <input type="checkbox" id="setting-emoji-user" ${currentValues.emojiUser ? 'checked' : ''}>
                        <span>Emoji User (uses emojis frequently)</span>
                    </label>
                </div>

                <button class="apply-settings-btn">Apply Settings</button>
            </div>
        </div>
    `;

    const activitySlider = content.querySelector('#setting-activity');
    const delaySlider = content.querySelector('#setting-delay');
    const responseProbSlider = content.querySelector('#setting-response-prob');
    const memorySlider = content.querySelector('#setting-memory');
    
    const sliderValue = content.querySelector('.slider-value');
    activitySlider.addEventListener('input', (e) => {
        activitySlider.nextElementSibling.textContent = `${e.target.value}%`;
    });
    
    delaySlider.addEventListener('input', (e) => {
        delaySlider.nextElementSibling.textContent = `${(e.target.value / 10).toFixed(1)}x`;
    });
    
    responseProbSlider.addEventListener('input', (e) => {
        responseProbSlider.nextElementSibling.textContent = `${e.target.value}%`;
    });
    
    memorySlider.addEventListener('input', (e) => {
        memorySlider.nextElementSibling.textContent = `${e.target.value}%`;
    });

    content.querySelector('.settings-back').addEventListener('click', renderUserSelection);
    content.querySelector('.apply-settings-btn').addEventListener('click', () => applySettings(isAllUsers));
}

function applySettings(isAllUsers) {
    const personality = document.getElementById('setting-personality').value;
    const mood = document.getElementById('setting-mood').value;
    const style = document.getElementById('setting-style').value;
    const activity = parseInt(document.getElementById('setting-activity').value) / 100;
    const messageDelay = parseInt(document.getElementById('setting-delay').value) / 10;
    const responseProbability = parseInt(document.getElementById('setting-response-prob').value) / 100;
    const memoryRetention = parseInt(document.getElementById('setting-memory').value) / 100;
    const topicInterests = document.getElementById('setting-interests').value.trim();
    const conflictTriggers = document.getElementById('setting-triggers').value.trim();
    const ruleBreaker = document.getElementById('setting-rulebreaker').checked;
    const conflictProne = document.getElementById('setting-conflict').checked;
    const learningEnabled = document.getElementById('setting-learning').checked;
    const emojiUser = document.getElementById('setting-emoji-user').checked;

    const updates = {
        personality,
        mood,
        communicationStyle: style,
        activityLevel: activity,
        messageDelay,
        responseProbability,
        memoryRetention,
        topicInterests,
        conflictTriggers,
        ruleBreaker,
        conflictProne,
        learningEnabled,
        emojiUser
    };

    if (isAllUsers) {
        participants.filter(p => p.role !== 'Admin').forEach(p => {
            Object.assign(p, updates);
        });
    } else {
        const user = participants.find(p => p.name === editingUser);
        if (user) {
            Object.assign(user, updates);
        }
    }

    renderParticipants();
    hideSettingsPanel();
}