import { participants, player, recentAdminActions, channels } from './state.js';
import { renderParticipants } from './user.js';
import { addMessageToChannel, createMessageDataObject } from './message.js';
import { scheduleNextBotMessage, triggerWidespreadReaction, runVoteSimulation } from './bot.js';
import { showModal, hideModal } from './ui.js';

let adminPanel;
let closeBtn;
let openBtn;

let currentAction = null; // 'warn', 'mute', 'ban', 'announce', or 'vote'
let selectedUser = null;

function showAdminPanel() {
    resetAdminPanel();
    showModal(adminPanel);
}

function hideAdminPanel() {
    hideModal(adminPanel);
    setTimeout(resetAdminPanel, 300);
}

function resetAdminPanel() {
    currentAction = null;
    selectedUser = null;
    renderActionSelection();
}

function postSystemMessage(text, type = null, details = {}) {
    const activeChannelItem = document.querySelector('.chat-list .chat-item.active');
    if (!activeChannelItem) return;
    const channelId = activeChannelItem.dataset.channel;

    const messageData = createMessageDataObject(null, text, null, true, type, details);
    addMessageToChannel(channelId, messageData);
}

function recordAdminAction(action, target, details = '') {
    const activeChannelItem = document.querySelector('.chat-list .chat-item.active');
    const channelId = activeChannelItem ? activeChannelItem.dataset.channel : null;

    const actionRecord = { action, target, details, timestamp: Date.now(), channelId };
    recentAdminActions.push(actionRecord);
    scheduleNextBotMessage(channelId);
}

function warnUser(userName) {
    const user = participants.find(p => p.name === userName);
    if (!user) return;

    user.warnings += 1;
    postSystemMessage(`⚠️ ${user.name} has been warned. (${user.warnings}/3 warnings)`);
    recordAdminAction('warn', user.name, `Count: ${user.warnings}`);

    if (user.warnings >= 3) {
        banUser(userName, 'exceeding warning limit');
    }
    hideAdminPanel();
}

function muteUser(userName, durationSeconds) {
    const user = participants.find(p => p.name === userName);
    if (!user || user.isMuted) return;

    user.isMuted = true;
    const durationText = durationSeconds >= 60 ? `${durationSeconds/60} minute(s)` : `${durationSeconds} seconds`;
    postSystemMessage(`🔇 ${user.name} has been muted for ${durationText}.`);
    recordAdminAction('mute', user.name, `Duration: ${durationText}`);

    setTimeout(() => {
        const stillMutedUser = participants.find(p => p.name === userName);
        if (stillMutedUser) {
            stillMutedUser.isMuted = false;
        }
    }, durationSeconds * 1000);
    hideAdminPanel();
}

function banUser(userName, reason = 'banned by admin') {
    const userIndex = participants.findIndex(p => p.name === userName);
    if (userIndex === -1) return;

    const [bannedUser] = participants.splice(userIndex, 1);
    postSystemMessage(`🔨 ${bannedUser.name} has been banned. Reason: ${reason}.`);
    recordAdminAction('ban', bannedUser.name, `Reason: ${reason}`);

    renderParticipants();
    hideAdminPanel();
}

function kickUser(userName) {
    const userIndex = participants.findIndex(p => p.name === userName);
    if (userIndex === -1) return;

    const [kickedUser] = participants.splice(userIndex, 1);
    postSystemMessage(`👢 ${kickedUser.name} has been kicked from the chat.`);
    recordAdminAction('kick', kickedUser.name, 'Kicked from chat');

    renderParticipants();
    hideAdminPanel();
    
    // User can "rejoin" after 30 seconds
    setTimeout(() => {
        participants.push(kickedUser);
        postSystemMessage(`${kickedUser.name} has rejoined the chat.`);
        renderParticipants();
    }, 30000);
}

function renderActionSelection() {
    const body = document.getElementById('admin-panel-participants-list');
    body.innerHTML = `
        <div class="admin-action-buttons">
            <button class="main-action-btn warn-btn" data-action="warn">
                <span class="action-icon">⚠️</span>
                <span class="action-label">Warn User</span>
            </button>
            <button class="main-action-btn mute-btn" data-action="mute">
                <span class="action-icon">🔇</span>
                <span class="action-label">Mute User</span>
            </button>
            <button class="main-action-btn ban-btn" data-action="ban">
                <span class="action-icon">🔨</span>
                <span class="action-label">Ban User</span>
            </button>
            <button class="main-action-btn" style="border-color: #ff6b6b; color: #ff6b6b;" data-action="kick">
                <span class="action-icon">👢</span>
                <span class="action-label">Kick User</span>
            </button>
            <button class="main-action-btn" style="border-color: #f39c12; color: #f39c12;" data-action="timeout">
                <span class="action-icon">⏱️</span>
                <span class="action-label">Timeout User</span>
            </button>
            <button class="main-action-btn" style="border-color: #4ecdc4; color: #4ecdc4;" data-action="change-rank">
                <span class="action-icon">🎖️</span>
                <span class="action-label">Change Rank</span>
            </button>
            <button class="main-action-btn" style="border-color: #95e1d3; color: #95e1d3;" data-action="change-nickname">
                <span class="action-icon">✏️</span>
                <span class="action-label">Change Nickname</span>
            </button>
            <button class="main-action-btn" style="border-color: #f38181; color: #f38181;" data-action="send-as-user">
                <span class="action-icon">🎭</span>
                <span class="action-label">Send as User <span style="font-size: 0.7rem;">(Sandbox)</span></span>
            </button>
            <button class="main-action-btn" style="border-color: #e74c3c; color: #e74c3c;" data-action="delete-messages">
                <span class="action-icon">🗑️</span>
                <span class="action-label">Delete Messages</span>
            </button>
            <button class="main-action-btn announce-btn" data-action="announce">
                <span class="action-icon">📢</span>
                <span class="action-label">Post Announcement</span>
            </button>
            <button class="main-action-btn" style="border-color: #3498db; color: #3498db;" data-action="broadcast">
                <span class="action-icon">📡</span>
                <span class="action-label">Broadcast (All Channels)</span>
            </button>
            <button class="main-action-btn vote-btn" data-action="vote">
                <span class="action-icon">🗳️</span>
                <span class="action-label">Start a Vote</span>
            </button>
            <button class="main-action-btn" style="border-color: #ffd93d; color: #ffd93d;" data-action="pin-message">
                <span class="action-icon">📌</span>
                <span class="action-label">Pin Message</span>
            </button>
            <button class="main-action-btn" style="border-color: #6bcf7f; color: #6bcf7f;" data-action="slow-mode">
                <span class="action-icon">🐌</span>
                <span class="action-label">Slow Mode</span>
            </button>
            <button class="main-action-btn" style="border-color: #c44569; color: #c44569;" data-action="clear-chat">
                <span class="action-icon">🗑️</span>
                <span class="action-label">Clear Chat</span>
            </button>
            <button class="main-action-btn" style="border-color: #e67e22; color: #e67e22;" data-action="lock-channel">
                <span class="action-icon">🔒</span>
                <span class="action-label">Lock/Unlock Channel</span>
            </button>
            <button class="main-action-btn" style="border-color: #9b59b6; color: #9b59b6;" data-action="view-user-info">
                <span class="action-icon">📊</span>
                <span class="action-label">View User Info</span>
            </button>
            <button class="main-action-btn" style="border-color: #1abc9c; color: #1abc9c;" data-action="grant-permissions">
                <span class="action-icon">🛡️</span>
                <span class="action-label">Grant Permissions</span>
            </button>
            <button class="main-action-btn" style="border-color: #34495e; color: #34495e;" data-action="bulk-mute">
                <span class="action-icon">🔇🔇</span>
                <span class="action-label">Bulk Mute All</span>
            </button>
            <button class="main-action-btn" style="border-color: #16a085; color: #16a085;" data-action="welcome-message">
                <span class="action-icon">👋</span>
                <span class="action-label">Set Welcome Message</span>
            </button>
            <button class="main-action-btn" style="border-color: #ff6b9d; color: #ff6b9d;" data-action="force-reaction">
                <span class="action-icon">😮</span>
                <span class="action-label">Force User Reaction <span style="font-size: 0.7rem;">(Sandbox)</span></span>
            </button>
            <button class="main-action-btn" style="border-color: #ff4757; color: #ff4757;" data-action="simulate-drama">
                <span class="action-icon">🎭</span>
                <span class="action-label">Simulate Drama <span style="font-size: 0.7rem;">(Sandbox)</span></span>
            </button>
            <button class="main-action-btn" style="border-color: #2ecc71; color: #2ecc71;" data-action="export-logs">
                <span class="action-icon">💾</span>
                <span class="action-label">Export Chat Logs</span>
            </button>
        </div>
    `;

    body.querySelectorAll('.main-action-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            currentAction = btn.dataset.action;
            if (currentAction === 'announce') {
                renderAnnouncementForm();
            } else if (currentAction === 'vote') {
                renderVoteForm();
            } else if (currentAction === 'pin-message') {
                renderPinMessageForm();
            } else if (currentAction === 'slow-mode') {
                renderSlowModeForm();
            } else if (currentAction === 'clear-chat') {
                executeClearChat();
            } else if (currentAction === 'broadcast') {
                renderBroadcastForm();
            } else if (currentAction === 'delete-messages') {
                renderDeleteMessagesForm();
            } else if (currentAction === 'lock-channel') {
                renderLockChannelForm();
            } else if (currentAction === 'bulk-mute') {
                executeBulkMute();
            } else if (currentAction === 'welcome-message') {
                renderWelcomeMessageForm();
            } else if (currentAction === 'simulate-drama') {
                renderSimulateDramaForm();
            } else if (currentAction === 'export-logs') {
                executeExportLogs();
            } else {
                renderUserSelection();
            }
        });
    });
}

function renderUserSelection() {
    const body = document.getElementById('admin-panel-participants-list');
    const eligibleUsers = participants.filter(p => p.role !== 'Admin');

    if (eligibleUsers.length === 0) {
        body.innerHTML = '<div class="no-users">No users available</div>';
        return;
    }

    const actionLabels = {
        warn: 'Select user to warn',
        mute: 'Select user to mute',
        ban: 'Select user to ban',
        kick: 'Select user to kick',
        timeout: 'Select user to timeout',
        'change-rank': 'Select user to change rank',
        'change-nickname': 'Select user to change nickname',
        'send-as-user': 'Select user to send message as',
        'view-user-info': 'Select user to view info',
        'grant-permissions': 'Select user to grant permissions',
        'force-reaction': 'Select user to force reaction (Sandbox)'
    };

    body.innerHTML = `
        <div class="user-selection-header">
            <button class="back-btn">← Back</button>
            <h3>${actionLabels[currentAction]}</h3>
        </div>
        <ul class="user-selection-list">
            ${eligibleUsers.map(user => `
                <li class="user-selection-item" data-username="${user.name}">
                    <img src="${user.avatar}" alt="${user.name}">
                    <div class="user-info">
                        <span class="username">${user.name}</span>
                        <span class="user-warnings">Warnings: ${user.warnings}/3 | Role: ${user.role}</span>
                    </div>
                    ${user.isMuted ? '<span class="muted-badge">MUTED</span>' : ''}
                </li>
            `).join('')}
        </ul>
    `;

    body.querySelector('.back-btn').addEventListener('click', resetAdminPanel);

    body.querySelectorAll('.user-selection-item').forEach(item => {
        item.addEventListener('click', () => {
            selectedUser = item.dataset.username;
            if (currentAction === 'mute') {
                renderMuteOptions();
            } else if (currentAction === 'timeout') {
                renderTimeoutOptions();
            } else if (currentAction === 'change-rank') {
                renderChangeRankForm();
            } else if (currentAction === 'change-nickname') {
                renderChangeNicknameForm();
            } else if (currentAction === 'send-as-user') {
                renderSendAsUserForm();
            } else if (currentAction === 'view-user-info') {
                renderUserInfoView();
            } else if (currentAction === 'grant-permissions') {
                renderGrantPermissionsForm();
            } else if (currentAction === 'force-reaction') {
                renderForceReactionForm();
            } else {
                executeAction();
            }
        });
    });
}

function renderMuteOptions() {
    const body = document.getElementById('admin-panel-participants-list');
    body.innerHTML = `
        <div class="user-selection-header">
            <button class="back-btn">← Back</button>
            <h3>Mute ${selectedUser}</h3>
        </div>
        <div class="mute-duration-options">
            <button class="duration-btn" data-duration="30">30 seconds</button>
            <button class="duration-btn" data-duration="60">1 minute</button>
            <button class="duration-btn" data-duration="300">5 minutes</button>
            <button class="duration-btn" data-duration="600">10 minutes</button>
            <button class="duration-btn" data-duration="1800">30 minutes</button>
        </div>
    `;

    body.querySelector('.back-btn').addEventListener('click', renderUserSelection);

    body.querySelectorAll('.duration-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const duration = parseInt(btn.dataset.duration, 10);
            muteUser(selectedUser, duration);
        });
    });
}

function renderAnnouncementForm() {
    const body = document.getElementById('admin-panel-participants-list');
    body.innerHTML = `
        <div class="user-selection-header">
            <button class="back-btn">← Back</button>
            <h3>Create Announcement</h3>
        </div>
        <div class="form-container">
            <textarea id="announcement-input" class="admin-textarea" placeholder="Type your global announcement here..."></textarea>
            <button id="post-announcement-btn" class="form-submit-btn">Post Announcement</button>
        </div>
    `;

    body.querySelector('.back-btn').addEventListener('click', resetAdminPanel);
    body.querySelector('#post-announcement-btn').addEventListener('click', handlePostAnnouncement);
}

function handlePostAnnouncement() {
    const input = document.getElementById('announcement-input');
    const message = input.value.trim();
    if (!message) return;

    // Find a channel to post to, preferably 'General'
    let channelId;
    const generalChannel = Array.from(document.querySelectorAll('.chat-list .chat-item')).find(el => el.dataset.channelName.toLowerCase() === 'general');
    const activeChannel = document.querySelector('.chat-list .chat-item.active');
    
    if (generalChannel) {
        channelId = generalChannel.dataset.channel;
    } else if (activeChannel) {
        channelId = activeChannel.dataset.channel;
    } else {
        const firstChannel = document.querySelector('.chat-list .chat-item');
        if (!firstChannel) {
            alert('No channels to post an announcement to.');
            return;
        }
        channelId = firstChannel.dataset.channel;
    }

    const messageData = createMessageDataObject(player.name, message, null, false, 'announcement');
    addMessageToChannel(channelId, messageData);
    
    recordAdminAction('announce', 'all', message.substring(0, 50));
    triggerWidespreadReaction(message, channelId);

    hideAdminPanel();
}


function renderVoteForm() {
    const body = document.getElementById('admin-panel-participants-list');
    body.innerHTML = `
        <div class="user-selection-header">
            <button class="back-btn">← Back</button>
            <h3>Start a Vote</h3>
        </div>
        <div class="form-container">
            <input type="text" id="vote-question-input" class="admin-input" placeholder="Vote Question...">
            <div id="vote-options-container">
                <input type="text" class="admin-input vote-option" placeholder="Option 1">
                <input type="text" class="admin-input vote-option" placeholder="Option 2">
            </div>
            <button id="add-vote-option-btn" class="form-secondary-btn">Add Option</button>
            <button id="start-vote-btn" class="form-submit-btn">Start Vote</button>
        </div>
    `;

    body.querySelector('.back-btn').addEventListener('click', resetAdminPanel);
    body.querySelector('#add-vote-option-btn').addEventListener('click', () => {
        const container = document.getElementById('vote-options-container');
        if (container.children.length < 5) { // Limit options
            const newOption = document.createElement('input');
            newOption.type = 'text';
            newOption.className = 'admin-input vote-option';
            newOption.placeholder = `Option ${container.children.length + 1}`;
            container.appendChild(newOption);
        }
    });
    body.querySelector('#start-vote-btn').addEventListener('click', handleStartVote);
}

function handleStartVote() {
    const question = document.getElementById('vote-question-input').value.trim();
    const options = Array.from(document.querySelectorAll('.vote-option'))
        .map(input => input.value.trim())
        .filter(option => option !== '');

    if (!question || options.length < 2) {
        alert('A vote requires a question and at least two options.');
        return;
    }

    const activeChannelItem = document.querySelector('.chat-list .chat-item.active');
    if (!activeChannelItem) {
        alert('You must be in a channel to start a vote.');
        return;
    }
    const channelId = activeChannelItem.dataset.channel;
    const duration = Math.floor(Math.random() * 31) + 30; // 30-60 seconds

    postSystemMessage(`A vote has started!`, 'vote_start', { question, options, duration });
    recordAdminAction('vote', 'all', `Question: ${question}`);
    runVoteSimulation(question, options, channelId, duration);

    hideAdminPanel();
}

function renderChangeRankForm() {
    const body = document.getElementById('admin-panel-participants-list');
    const user = participants.find(p => p.name === selectedUser);
    
    body.innerHTML = `
        <div class="user-selection-header">
            <button class="back-btn">← Back</button>
            <h3>Change Rank: ${selectedUser}</h3>
        </div>
        <div class="form-container">
            <label style="color: var(--primary-color); margin-bottom: 0.5rem;">Select New Rank:</label>
            <select id="rank-select" class="admin-input" style="padding: 0.75rem;">
                <option value="Member" ${user?.role === 'Member' ? 'selected' : ''}>Member</option>
                <option value="Moderator">Moderator</option>
                <option value="VIP">VIP</option>
                <option value="Helper">Helper</option>
                <option value="Verified">Verified</option>
            </select>
            <button id="apply-rank-btn" class="form-submit-btn">Apply Rank</button>
        </div>
    `;

    body.querySelector('.back-btn').addEventListener('click', renderUserSelection);
    body.querySelector('#apply-rank-btn').addEventListener('click', () => {
        const newRank = document.getElementById('rank-select').value;
        changeUserRank(selectedUser, newRank);
    });
}

function changeUserRank(userName, newRank) {
    const user = participants.find(p => p.name === userName);
    if (!user) return;

    const oldRank = user.role;
    user.role = newRank;
    
    postSystemMessage(`🎖️ ${userName}'s rank has been changed from ${oldRank} to ${newRank}.`);
    recordAdminAction('change-rank', userName, `${oldRank} → ${newRank}`);
    renderParticipants();
    hideAdminPanel();
}

function renderChangeNicknameForm() {
    const body = document.getElementById('admin-panel-participants-list');
    const user = participants.find(p => p.name === selectedUser);
    
    body.innerHTML = `
        <div class="user-selection-header">
            <button class="back-btn">← Back</button>
            <h3>Change Nickname: ${selectedUser}</h3>
        </div>
        <div class="form-container">
            <label style="color: var(--primary-color); margin-bottom: 0.5rem;">New Nickname:</label>
            <input type="text" id="new-nickname-input" class="admin-input" placeholder="Enter new nickname..." value="${user?.name || ''}">
            <textarea id="nickname-reason-input" class="admin-textarea" placeholder="Reason for change (optional)..." rows="3"></textarea>
            <button id="apply-nickname-btn" class="form-submit-btn">Apply Change</button>
        </div>
    `;

    body.querySelector('.back-btn').addEventListener('click', renderUserSelection);
    body.querySelector('#apply-nickname-btn').addEventListener('click', () => {
        const newNickname = document.getElementById('new-nickname-input').value.trim();
        const reason = document.getElementById('nickname-reason-input').value.trim();
        if (newNickname) {
            changeUserNickname(selectedUser, newNickname, reason);
        }
    });
}

function changeUserNickname(oldName, newName, reason) {
    const user = participants.find(p => p.name === oldName);
    if (!user || !newName) return;

    user.name = newName;
    
    const reasonText = reason ? ` (Reason: ${reason})` : '';
    postSystemMessage(`✏️ ${oldName} has been renamed to ${newName}${reasonText}`);
    recordAdminAction('change-nickname', `${oldName} → ${newName}`, reason);
    renderParticipants();
    hideAdminPanel();
}

function renderSendAsUserForm() {
    const body = document.getElementById('admin-panel-participants-list');
    
    body.innerHTML = `
        <div class="user-selection-header">
            <button class="back-btn">← Back</button>
            <h3>Send as: ${selectedUser}</h3>
            <p style="color: #ffc107; font-size: 0.9rem; margin-top: 0.5rem;">⚠️ Sandbox Feature - User will react confused</p>
        </div>
        <div class="form-container">
            <textarea id="impersonate-message-input" class="admin-textarea" placeholder="Message to send as this user..."></textarea>
            <button id="send-impersonate-btn" class="form-submit-btn">Send Message</button>
        </div>
    `;

    body.querySelector('.back-btn').addEventListener('click', renderUserSelection);
    body.querySelector('#send-impersonate-btn').addEventListener('click', () => {
        const message = document.getElementById('impersonate-message-input').value.trim();
        if (message) {
            sendAsUser(selectedUser, message);
        }
    });
}

async function sendAsUser(userName, message) {
    const activeChannelItem = document.querySelector('.chat-list .chat-item.active');
    if (!activeChannelItem) return;
    const channelId = activeChannelItem.dataset.channel;

    // Send the message as the user
    const messageData = createMessageDataObject(userName, message);
    addMessageToChannel(channelId, messageData);
    
    recordAdminAction('send-as-user', userName, message.substring(0, 50));
    hideAdminPanel();

    // User reacts confused after 2-5 seconds
    const delay = (Math.random() * 3 + 2) * 1000;
    setTimeout(async () => {
        const user = participants.find(p => p.name === userName);
        if (!user) return;

        try {
            const prompt = `You are ${userName} (${user.personality}, ${user.mood}). 
You just noticed a message in your name that you DIDN'T send: "${message}"
React with confusion, surprise, or concern. Be brief and realistic (1-15 words).
Examples: "wait what?? i didnt send that", "wtf my account got hacked??", "bro i didnt type that lol"`;

            const completion = await websim.chat.completions.create({
                messages: [
                    { role: 'system', content: 'You are human. React with genuine confusion to a message you didn\'t send.' },
                    { role: 'user', content: prompt }
                ]
            });
            
            const reactionData = createMessageDataObject(userName, completion.content.trim());
            addMessageToChannel(channelId, reactionData);
        } catch (error) {
            console.error("Confused reaction failed:", error);
            // Fallback reaction
            const fallbacks = [
                "wait i didnt send that??",
                "wtf how did that get sent",
                "bro what i didnt type that",
                "huh? that wasnt me"
            ];
            const reactionData = createMessageDataObject(userName, fallbacks[Math.floor(Math.random() * fallbacks.length)]);
            addMessageToChannel(channelId, reactionData);
        }
    }, delay);
}

function renderPinMessageForm() {
    const body = document.getElementById('admin-panel-participants-list');
    const activeChannelItem = document.querySelector('.chat-list .chat-item.active');
    if (!activeChannelItem) {
        body.innerHTML = '<div class="no-users">You must be in a channel to pin a message.</div>';
        return;
    }

    body.innerHTML = `
        <div class="user-selection-header">
            <button class="back-btn">← Back</button>
            <h3>Pin Message to Channel</h3>
        </div>
        <div class="form-container">
            <textarea id="pin-message-input" class="admin-textarea" placeholder="Message to pin..."></textarea>
            <button id="pin-message-btn" class="form-submit-btn">Pin Message</button>
        </div>
    `;

    body.querySelector('.back-btn').addEventListener('click', resetAdminPanel);
    body.querySelector('#pin-message-btn').addEventListener('click', () => {
        const message = document.getElementById('pin-message-input').value.trim();
        if (message) {
            pinMessage(message);
        }
    });
}

function pinMessage(message) {
    const activeChannelItem = document.querySelector('.chat-list .chat-item.active');
    if (!activeChannelItem) return;
    const channelId = activeChannelItem.dataset.channel;

    postSystemMessage(`📌 Pinned: ${message}`, 'announcement');
    recordAdminAction('pin-message', 'channel', message.substring(0, 50));
    hideAdminPanel();
}

function renderSlowModeForm() {
    const body = document.getElementById('admin-panel-participants-list');
    
    body.innerHTML = `
        <div class="user-selection-header">
            <button class="back-btn">← Back</button>
            <h3>Enable Slow Mode</h3>
        </div>
        <div class="mute-duration-options">
            <button class="duration-btn" data-duration="5">5 seconds</button>
            <button class="duration-btn" data-duration="10">10 seconds</button>
            <button class="duration-btn" data-duration="30">30 seconds</button>
            <button class="duration-btn" data-duration="60">60 seconds</button>
            <button class="duration-btn" data-duration="0">Disable Slow Mode</button>
        </div>
    `;

    body.querySelector('.back-btn').addEventListener('click', resetAdminPanel);
    
    body.querySelectorAll('.duration-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const duration = parseInt(btn.dataset.duration, 10);
            enableSlowMode(duration);
        });
    });
}

function enableSlowMode(seconds) {
    if (seconds === 0) {
        postSystemMessage(`🐌 Slow mode has been disabled.`);
        recordAdminAction('slow-mode', 'disabled', '0 seconds');
    } else {
        postSystemMessage(`🐌 Slow mode enabled. Users can send messages every ${seconds} seconds.`);
        recordAdminAction('slow-mode', 'enabled', `${seconds} seconds`);
    }
    hideAdminPanel();
}

function executeClearChat() {
    const activeChannelItem = document.querySelector('.chat-list .chat-item.active');
    if (!activeChannelItem) {
        alert('You must be in a channel to clear chat.');
        return;
    }
    
    const confirmed = confirm('Are you sure you want to clear all messages in this channel?');
    if (!confirmed) return;

    const channelId = activeChannelItem.dataset.channel;
    if (channels[channelId]) {
        channels[channelId] = [];
    }
    
    const chatMessagesContainer = document.getElementById('chat-messages-container');
    chatMessagesContainer.innerHTML = '';
    
    postSystemMessage(`🗑️ Chat has been cleared by Admin.`);
    recordAdminAction('clear-chat', 'channel', 'All messages removed');
    hideAdminPanel();
}

function renderTimeoutOptions() {
    const body = document.getElementById('admin-panel-participants-list');
    body.innerHTML = `
        <div class="user-selection-header">
            <button class="back-btn">← Back</button>
            <h3>Timeout ${selectedUser}</h3>
        </div>
        <div class="mute-duration-options">
            <button class="duration-btn" data-duration="60">1 minute</button>
            <button class="duration-btn" data-duration="300">5 minutes</button>
            <button class="duration-btn" data-duration="600">10 minutes</button>
            <button class="duration-btn" data-duration="1800">30 minutes</button>
            <button class="duration-btn" data-duration="3600">1 hour</button>
        </div>
    `;

    body.querySelector('.back-btn').addEventListener('click', renderUserSelection);

    body.querySelectorAll('.duration-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const duration = parseInt(btn.dataset.duration, 10);
            timeoutUser(selectedUser, duration);
        });
    });
}

function timeoutUser(userName, durationSeconds) {
    const user = participants.find(p => p.name === userName);
    if (!user) return;

    user.presence = 'offline';
    const durationText = durationSeconds >= 60 ? `${durationSeconds/60} minute(s)` : `${durationSeconds} seconds`;
    postSystemMessage(`⏱️ ${user.name} has been timed out for ${durationText}.`);
    recordAdminAction('timeout', user.name, `Duration: ${durationText}`);

    setTimeout(() => {
        const stillTimedOutUser = participants.find(p => p.name === userName);
        if (stillTimedOutUser) {
            stillTimedOutUser.presence = 'online';
            postSystemMessage(`${stillTimedOutUser.name} timeout has ended.`);
        }
    }, durationSeconds * 1000);
    hideAdminPanel();
}

function renderBroadcastForm() {
    const body = document.getElementById('admin-panel-participants-list');
    body.innerHTML = `
        <div class="user-selection-header">
            <button class="back-btn">← Back</button>
            <h3>Broadcast to All Channels</h3>
        </div>
        <div class="form-container">
            <textarea id="broadcast-input" class="admin-textarea" placeholder="Message to broadcast to all channels..."></textarea>
            <button id="post-broadcast-btn" class="form-submit-btn">Broadcast</button>
        </div>
    `;

    body.querySelector('.back-btn').addEventListener('click', resetAdminPanel);
    body.querySelector('#post-broadcast-btn').addEventListener('click', handleBroadcast);
}

function handleBroadcast() {
    const input = document.getElementById('broadcast-input');
    const message = input.value.trim();
    if (!message) return;

    const allChannelIds = Object.keys(channels);
    allChannelIds.forEach(channelId => {
        const messageData = createMessageDataObject(player.name, message, null, false, 'announcement');
        addMessageToChannel(channelId, messageData);
    });

    recordAdminAction('broadcast', 'all channels', message.substring(0, 50));
    hideAdminPanel();
}

function renderDeleteMessagesForm() {
    const body = document.getElementById('admin-panel-participants-list');
    const activeChannelItem = document.querySelector('.chat-list .chat-item.active');
    if (!activeChannelItem) {
        body.innerHTML = '<div class="no-users">You must be in a channel to delete messages.</div>';
        return;
    }

    const channelId = activeChannelItem.dataset.channel;
    const recentMessages = (channels[channelId] || []).slice(-20).filter(m => !m.isSystemMessage);

    body.innerHTML = `
        <div class="user-selection-header">
            <button class="back-btn">← Back</button>
            <h3>Delete Messages</h3>
        </div>
        <div style="max-height: 400px; overflow-y: auto; padding: 1rem;">
            ${recentMessages.length === 0 ? '<div class="no-users">No messages to delete</div>' : 
                recentMessages.map(msg => `
                    <div style="background: rgba(0,0,0,0.3); padding: 1rem; margin-bottom: 0.5rem; border-radius: 5px; border: 1px solid rgba(0,255,255,0.1);">
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <div>
                                <strong style="color: var(--primary-color);">${msg.author}</strong>
                                <span style="color: #888; font-size: 0.8rem; margin-left: 0.5rem;">${msg.timestamp}</span>
                                <p style="margin-top: 0.5rem; color: var(--text-color);">${msg.text.substring(0, 100)}${msg.text.length > 100 ? '...' : ''}</p>
                            </div>
                            <button class="delete-msg-btn" data-msg-id="${msg.id}" style="background: #dc3545; color: white; border: none; padding: 0.5rem 1rem; border-radius: 5px; cursor: pointer;">Delete</button>
                        </div>
                    </div>
                `).join('')
            }
        </div>
    `;

    body.querySelector('.back-btn').addEventListener('click', resetAdminPanel);
    body.querySelectorAll('.delete-msg-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const msgId = btn.dataset.msgId;
            deleteMessage(channelId, msgId);
            btn.closest('div').remove();
        });
    });
}

function deleteMessage(channelId, messageId) {
    if (!channels[channelId]) return;
    const index = channels[channelId].findIndex(m => m.id === messageId);
    if (index !== -1) {
        channels[channelId].splice(index, 1);
        renderMessagesForChannel(channelId);
        recordAdminAction('delete-message', 'message', messageId);
    }
}

function renderLockChannelForm() {
    const body = document.getElementById('admin-panel-participants-list');
    const allChannels = Array.from(document.querySelectorAll('.chat-list .chat-item'));

    body.innerHTML = `
        <div class="user-selection-header">
            <button class="back-btn">← Back</button>
            <h3>Lock/Unlock Channels</h3>
        </div>
        <div style="padding: 1rem;">
            ${allChannels.map(ch => {
                const channelName = ch.dataset.channelName;
                const isLocked = ch.dataset.locked === 'true';
                return `
                    <div style="display: flex; justify-content: space-between; align-items: center; padding: 1rem; background: rgba(0,0,0,0.2); margin-bottom: 0.5rem; border-radius: 5px;">
                        <span style="color: var(--text-color); font-size: 1.1rem;"># ${channelName}</span>
                        <button class="toggle-lock-btn" data-channel="${ch.dataset.channel}" data-locked="${isLocked}" 
                            style="background: ${isLocked ? '#2ecc71' : '#e74c3c'}; color: white; border: none; padding: 0.5rem 1rem; border-radius: 5px; cursor: pointer;">
                            ${isLocked ? '🔓 Unlock' : '🔒 Lock'}
                        </button>
                    </div>
                `;
            }).join('')}
        </div>
    `;

    body.querySelector('.back-btn').addEventListener('click', resetAdminPanel);
    body.querySelectorAll('.toggle-lock-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const channelId = btn.dataset.channel;
            const isLocked = btn.dataset.locked === 'true';
            toggleChannelLock(channelId, !isLocked);
            btn.textContent = isLocked ? '🔒 Lock' : '🔓 Unlock';
            btn.dataset.locked = !isLocked;
            btn.style.background = isLocked ? '#e74c3c' : '#2ecc71';
        });
    });
}

function toggleChannelLock(channelId, shouldLock) {
    const channelItem = document.querySelector(`.chat-list .chat-item[data-channel="${channelId}"]`);
    if (channelItem) {
        channelItem.dataset.locked = shouldLock;
        const channelName = channelItem.dataset.channelName;
        postSystemMessage(`🔒 Channel #${channelName} has been ${shouldLock ? 'locked' : 'unlocked'}.`);
        recordAdminAction('lock-channel', channelName, shouldLock ? 'locked' : 'unlocked');
    }
}

function renderUserInfoView() {
    const user = participants.find(p => p.name === selectedUser);
    if (!user) return;

    const body = document.getElementById('admin-panel-participants-list');
    body.innerHTML = `
        <div class="user-selection-header">
            <button class="back-btn">← Back</button>
            <h3>User Info: ${user.name}</h3>
        </div>
        <div style="padding: 1.5rem; color: var(--text-color);">
            <div style="margin-bottom: 1rem;">
                <img src="${user.avatar}" style="width: 80px; height: 80px; border-radius: 50%; margin-bottom: 1rem;">
                <h3 style="color: var(--primary-color); margin-bottom: 0.5rem;">${user.name}</h3>
            </div>
            <div style="background: rgba(0,0,0,0.3); padding: 1rem; border-radius: 5px; margin-bottom: 1rem;">
                <p><strong>Role:</strong> ${user.role}</p>
                <p><strong>Warnings:</strong> ${user.warnings}/3</p>
                <p><strong>Status:</strong> ${user.isMuted ? 'Muted' : 'Active'}</p>
                <p><strong>Presence:</strong> ${user.presence}</p>
            </div>
            <div style="background: rgba(0,0,0,0.3); padding: 1rem; border-radius: 5px; margin-bottom: 1rem;">
                <h4 style="color: var(--primary-color); margin-bottom: 0.5rem;">Personality</h4>
                <p><strong>Type:</strong> ${user.personality}</p>
                <p><strong>Mood:</strong> ${user.mood}</p>
                <p><strong>Style:</strong> ${user.communicationStyle}</p>
                <p><strong>Activity Level:</strong> ${Math.round(user.activityLevel * 100)}%</p>
                <p><strong>Traits:</strong> ${user.ruleBreaker ? 'Rule Breaker, ' : ''}${user.conflictProne ? 'Conflict Prone' : 'Peaceful'}</p>
            </div>
        </div>
    `;

    body.querySelector('.back-btn').addEventListener('click', renderUserSelection);
}

function renderGrantPermissionsForm() {
    const user = participants.find(p => p.name === selectedUser);
    if (!user) return;

    const body = document.getElementById('admin-panel-participants-list');
    body.innerHTML = `
        <div class="user-selection-header">
            <button class="back-btn">← Back</button>
            <h3>Grant Permissions: ${selectedUser}</h3>
        </div>
        <div class="form-container">
            <label style="color: var(--primary-color); margin-bottom: 1rem; display: block;">Select Permissions:</label>
            <div style="display: flex; flex-direction: column; gap: 1rem;">
                <label class="checkbox-label">
                    <input type="checkbox" id="perm-delete-msg">
                    <span>Delete Messages</span>
                </label>
                <label class="checkbox-label">
                    <input type="checkbox" id="perm-mute-users">
                    <span>Mute Users</span>
                </label>
                <label class="checkbox-label">
                    <input type="checkbox" id="perm-kick-users">
                    <span>Kick Users</span>
                </label>
                <label class="checkbox-label">
                    <input type="checkbox" id="perm-manage-channels">
                    <span>Manage Channels</span>
                </label>
            </div>
            <button id="grant-perms-btn" class="form-submit-btn" style="margin-top: 1rem;">Grant Permissions</button>
        </div>
    `;

    body.querySelector('.back-btn').addEventListener('click', renderUserSelection);
    body.querySelector('#grant-perms-btn').addEventListener('click', () => {
        const permissions = {
            deleteMessages: document.getElementById('perm-delete-msg').checked,
            muteUsers: document.getElementById('perm-mute-users').checked,
            kickUsers: document.getElementById('perm-kick-users').checked,
            manageChannels: document.getElementById('perm-manage-channels').checked
        };
        grantPermissions(selectedUser, permissions);
    });
}

function grantPermissions(userName, permissions) {
    const user = participants.find(p => p.name === userName);
    if (!user) return;

    user.permissions = permissions;
    const grantedPerms = Object.entries(permissions).filter(([k, v]) => v).map(([k]) => k).join(', ');
    postSystemMessage(`🛡️ ${userName} has been granted permissions: ${grantedPerms}`);
    recordAdminAction('grant-permissions', userName, grantedPerms);
    hideAdminPanel();
}

function executeBulkMute() {
    const confirmed = confirm('Are you sure you want to mute ALL users for 5 minutes?');
    if (!confirmed) return;

    const bots = participants.filter(p => p.role !== 'Admin');
    bots.forEach(bot => {
        bot.isMuted = true;
        setTimeout(() => {
            bot.isMuted = false;
        }, 300000); // 5 minutes
    });

    postSystemMessage(`🔇 All users have been muted for 5 minutes.`);
    recordAdminAction('bulk-mute', 'all users', '5 minutes');
    hideAdminPanel();
}

function renderWelcomeMessageForm() {
    const body = document.getElementById('admin-panel-participants-list');
    body.innerHTML = `
        <div class="user-selection-header">
            <button class="back-btn">← Back</button>
            <h3>Set Welcome Message</h3>
        </div>
        <div class="form-container">
            <textarea id="welcome-msg-input" class="admin-textarea" placeholder="Welcome message for new users..."></textarea>
            <button id="set-welcome-btn" class="form-submit-btn">Set Welcome Message</button>
        </div>
    `;

    body.querySelector('.back-btn').addEventListener('click', resetAdminPanel);
    body.querySelector('#set-welcome-btn').addEventListener('click', () => {
        const message = document.getElementById('welcome-msg-input').value.trim();
        if (message) {
            postSystemMessage(`👋 Welcome message set: "${message}"`);
            recordAdminAction('welcome-message', 'system', message.substring(0, 50));
            hideAdminPanel();
        }
    });
}

function renderForceReactionForm() {
    const body = document.getElementById('admin-panel-participants-list');
    body.innerHTML = `
        <div class="user-selection-header">
            <button class="back-btn">← Back</button>
            <h3>Force Reaction: ${selectedUser}</h3>
            <p style="color: #ffc107; font-size: 0.9rem; margin-top: 0.5rem;">⚠️ Sandbox Feature - Forces user to react</p>
        </div>
        <div class="form-container">
            <label style="color: var(--primary-color); margin-bottom: 0.5rem;">Select Emotion:</label>
            <select id="force-emotion-select" class="admin-input">
                <option value="happy">😊 Happy</option>
                <option value="angry">😠 Angry</option>
                <option value="sad">😢 Sad</option>
                <option value="surprised">😮 Surprised</option>
                <option value="confused">😕 Confused</option>
                <option value="excited">🤩 Excited</option>
            </select>
            <textarea id="force-context-input" class="admin-textarea" placeholder="Context for reaction (optional)..." rows="3"></textarea>
            <button id="force-reaction-btn" class="form-submit-btn">Force Reaction</button>
        </div>
    `;

    body.querySelector('.back-btn').addEventListener('click', renderUserSelection);
    body.querySelector('#force-reaction-btn').addEventListener('click', async () => {
        const emotion = document.getElementById('force-emotion-select').value;
        const context = document.getElementById('force-context-input').value.trim();
        await forceUserReaction(selectedUser, emotion, context);
    });
}

async function forceUserReaction(userName, emotion, context) {
    const user = participants.find(p => p.name === userName);
    if (!user) return;

    const activeChannelItem = document.querySelector('.chat-list .chat-item.active');
    if (!activeChannelItem) return;
    const channelId = activeChannelItem.dataset.channel;

    try {
        const prompt = `You are ${userName} (${user.personality}).
You suddenly feel ${emotion}.
${context ? `Context: ${context}` : ''}
React briefly and naturally (1-10 words). Show the ${emotion} emotion clearly.`;

        const completion = await websim.chat.completions.create({
            messages: [
                { role: 'system', content: `Express ${emotion} emotion naturally and briefly.` },
                { role: 'user', content: prompt }
            ]
        });

        const messageData = createMessageDataObject(userName, completion.content.trim());
        addMessageToChannel(channelId, messageData);
        
        recordAdminAction('force-reaction', userName, `${emotion}: ${completion.content.substring(0, 30)}`);
        hideAdminPanel();
    } catch (error) {
        console.error("Force reaction failed:", error);
        alert('Failed to force reaction. Please try again.');
    }
}

function renderSimulateDramaForm() {
    const body = document.getElementById('admin-panel-participants-list');
    body.innerHTML = `
        <div class="user-selection-header">
            <button class="back-btn">← Back</button>
            <h3>Simulate Drama</h3>
            <p style="color: #ffc107; font-size: 0.9rem; margin-top: 0.5rem;">⚠️ Sandbox Feature - Creates artificial conflict</p>
        </div>
        <div class="form-container">
            <label style="color: var(--primary-color); margin-bottom: 0.5rem;">Drama Type:</label>
            <select id="drama-type-select" class="admin-input">
                <option value="argument">Heated Argument</option>
                <option value="misunderstanding">Misunderstanding</option>
                <option value="accusation">False Accusation</option>
                <option value="rivalry">Sudden Rivalry</option>
            </select>
            <textarea id="drama-topic-input" class="admin-textarea" placeholder="Drama topic (optional)..." rows="3"></textarea>
            <button id="start-drama-btn" class="form-submit-btn">Start Drama</button>
        </div>
    `;

    body.querySelector('.back-btn').addEventListener('click', resetAdminPanel);
    body.querySelector('#start-drama-btn').addEventListener('click', async () => {
        const dramaType = document.getElementById('drama-type-select').value;
        const topic = document.getElementById('drama-topic-input').value.trim();
        await simulateDrama(dramaType, topic);
    });
}

async function simulateDrama(dramaType, topic) {
    const activeChannelItem = document.querySelector('.chat-list .chat-item.active');
    if (!activeChannelItem) return;
    const channelId = activeChannelItem.dataset.channel;

    const bots = participants.filter(p => p.role !== 'Admin' && !p.isMuted);
    if (bots.length < 2) {
        alert('Need at least 2 users for drama simulation.');
        return;
    }

    const [user1, user2] = bots.sort(() => 0.5 - Math.random()).slice(0, 2);
    
    hideAdminPanel();

    const dramaScenarios = {
        argument: `${user1.name} and ${user2.name} start arguing about ${topic || 'something trivial'}`,
        misunderstanding: `${user1.name} misunderstands what ${user2.name} said${topic ? ` about ${topic}` : ''}`,
        accusation: `${user1.name} falsely accuses ${user2.name}${topic ? ` of ${topic}` : ''}`,
        rivalry: `${user1.name} and ${user2.name} suddenly become competitive${topic ? ` about ${topic}` : ''}`
    };

    postSystemMessage(`🎭 Drama simulation started: ${dramaScenarios[dramaType]}`);
    recordAdminAction('simulate-drama', `${user1.name} vs ${user2.name}`, dramaType);

    for (let i = 0; i < 6; i++) {
        setTimeout(async () => {
            const currentUser = i % 2 === 0 ? user1 : user2;
            const otherUser = i % 2 === 0 ? user2 : user1;

            try {
                const prompt = `You are ${currentUser.name} (${currentUser.personality}, ${currentUser.mood}).
You are in a ${dramaType} with ${otherUser.name}.
${topic ? `Topic: ${topic}` : ''}
Message ${i + 1}/6 - ${i < 2 ? 'Start the conflict' : i < 4 ? 'Escalate' : 'Calm down or continue'}
Write ONE brief, emotional message (1-15 words):`;

                const completion = await websim.chat.completions.create({
                    messages: [
                        { role: 'system', content: `You are involved in ${dramaType}. Be emotional and realistic.` },
                        { role: 'user', content: prompt }
                    ]
                });

                const messageData = createMessageDataObject(currentUser.name, completion.content.trim());
                addMessageToChannel(channelId, messageData);
            } catch (error) {
                console.error("Drama simulation message failed:", error);
            }
        }, i * 4000);
    }
}

function executeExportLogs() {
    const allChannelIds = Object.keys(channels);
    const logs = {};

    allChannelIds.forEach(channelId => {
        const channelItem = document.querySelector(`.chat-list .chat-item[data-channel="${channelId}"]`);
        const channelName = channelItem ? channelItem.dataset.channelName : channelId;
        logs[channelName] = channels[channelId].map(msg => ({
            author: msg.author || 'System',
            text: msg.text,
            timestamp: msg.timestamp,
            isSystem: msg.isSystemMessage
        }));
    });

    const dataStr = JSON.stringify(logs, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `chat-logs-${Date.now()}.json`;
    link.click();
    URL.revokeObjectURL(url);

    recordAdminAction('export-logs', 'all channels', `${allChannelIds.length} channels`);
    hideAdminPanel();
}

function executeAction() {
    if (!selectedUser) return;

    switch(currentAction) {
        case 'warn':
            warnUser(selectedUser);
            break;
        case 'ban':
            banUser(selectedUser);
            break;
        case 'kick':
            kickUser(selectedUser);
            break;
    }
}

export function setupAdminPanel() {
    adminPanel = document.getElementById('admin-panel-modal');
    closeBtn = document.getElementById('close-admin-panel-btn');
    openBtn = document.getElementById('admin-panel-btn');

    if (openBtn) openBtn.addEventListener('click', showAdminPanel);
    if (closeBtn) closeBtn.addEventListener('click', hideAdminPanel);
    if (adminPanel) {
        adminPanel.addEventListener('click', (e) => {
            if (e.target === adminPanel) {
                hideAdminPanel();
            }
        });
    }
}