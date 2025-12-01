import { channels, player, participants } from './state.js';
import { scheduleNextBotMessage } from './bot.js';

export function createMessageDataObject(author, text, replyTo = null, isSystemMessage = false, type = null, details = {}) {
    const now = new Date();
    return {
        id: `${now.getTime()}-${Math.random()}`,
        author,
        text,
        timestamp: `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`,
        replyTo,
        isSystemMessage,
        type, // e.g., 'announcement', 'vote_start', 'vote_result'
        details // e.g., { question: '..', options: ['..'] }
    };
}

function highlightMentions(text) {
    // Replace @username with highlighted version
    return text.replace(/@(\w+)/g, '<span class="mention">@$1</span>');
}

function createMessageElement(messageData, channelId) {
    const { id, author, text, timestamp, replyTo, isSystemMessage, type, details } = messageData;

    if (type === 'announcement') {
        const announceEl = document.createElement('div');
        announceEl.className = 'announcement-message';
        announceEl.innerHTML = `
            <div class="announcement-header">
                <img src="${player.avatar}" alt="Admin Avatar">
                <span>Announcement from ${author}</span>
            </div>
            <div class="announcement-body">${highlightMentions(text.replace(/</g, "&lt;").replace(/>/g, "&gt;"))}</div>
        `;
        return announceEl;
    }

    if (type === 'vote_start') {
        const voteEl = document.createElement('div');
        voteEl.className = 'vote-message';
        voteEl.innerHTML = `
            <div class="vote-header">🗳️ Vote Started!</div>
            <div class="vote-question">${details.question}</div>
            <ul class="vote-options">
                ${details.options.map(opt => `<li>${opt}</li>`).join('')}
            </ul>
            <div class="vote-footer">Discussion and voting will last for ${details.duration} seconds.</div>
        `;
        return voteEl;
    }

    if (type === 'vote_result') {
        const resultEl = document.createElement('div');
        resultEl.className = 'vote-result-message';
        const resultsHTML = details.results.map(res => {
            const percentage = details.totalVotes > 0 ? ((res.count / details.totalVotes) * 100).toFixed(0) : 0;
            return `
                <div class="result-item">
                    <div class="result-info">
                        <span class="result-option">${res.option}</span>
                        <span class="result-count">${res.count} votes (${percentage}%)</span>
                    </div>
                    <div class="result-bar-container">
                        <div class="result-bar" style="width: ${percentage}%;"></div>
                    </div>
                </div>
            `;
        }).join('');

        resultEl.innerHTML = `
            <div class="vote-header">📈 Vote Results</div>
            <div class="vote-question">${details.question}</div>
            <div class="vote-results-list">${resultsHTML}</div>
            <div class="vote-footer">Total Votes: ${details.totalVotes}</div>
        `;
        return resultEl;
    }

    if (isSystemMessage) {
        const systemEl = document.createElement('li');
        systemEl.className = 'system-message';
        systemEl.textContent = text;
        return systemEl;
    }

    const messageEl = document.createElement('div');
    messageEl.className = 'message-item';
    messageEl.dataset.messageId = id;

    const authorIsAdmin = author === player.name;
    const authorData = participants.find(p => p.name === author) || { avatar: '/user-icon.png' };

    let replyHTML = '';
    if (replyTo) {
        const channelHistory = channels[channelId] || [];
        const originalMessage = channelHistory.find(m => m.id === replyTo);
        if (originalMessage) {
            const originalAuthorIsAdmin = originalMessage.author === player.name;
            replyHTML = `
                <div class="reply-context">
                    <span class="reply-author ${originalAuthorIsAdmin ? 'admin' : ''}">${originalMessage.author}</span>
                    <span class="reply-text">${originalMessage.text}</span>
                </div>
            `;
        }
    }

    const highlightedText = highlightMentions(text.replace(/</g, "&lt;").replace(/>/g, "&gt;"));

    messageEl.innerHTML = `
        <img src="${authorData.avatar}" alt="${author}'s avatar" class="message-avatar">
        <div class="message-content">
            ${replyHTML}
            <div class="message-header">
                <span class="message-author ${authorIsAdmin ? 'admin' : ''}">${author}</span>
                <span class="message-timestamp">${timestamp}</span>
            </div>
            <div class="message-text">${highlightedText}</div>
        </div>
    `;
    return messageEl;
}

export function renderMessagesForChannel(channelId) {
    const chatMessagesContainer = document.getElementById('chat-messages-container');
    chatMessagesContainer.innerHTML = '';

    if (channels[channelId]) {
        channels[channelId].forEach(msg => {
            const messageElement = createMessageElement(msg, channelId);
            chatMessagesContainer.appendChild(messageElement);
        });
    }

    chatMessagesContainer.scrollTop = chatMessagesContainer.scrollHeight;
}

export function addMessageToChannel(channelId, messageData) {
    if (!channels[channelId]) channels[channelId] = [];
    channels[channelId].push(messageData);

    const activeChannelItem = document.querySelector('.chat-list .chat-item.active');
    if (activeChannelItem && activeChannelItem.dataset.channel === channelId) {
        const messageElement = createMessageElement(messageData, channelId);
        const container = document.getElementById('chat-messages-container');
        container.appendChild(messageElement);
        container.scrollTop = container.scrollHeight;
    } else {
        const channelListItem = document.querySelector(`.chat-list .chat-item[data-channel="${channelId}"]`);
        if (channelListItem) {
            const indicator = channelListItem.querySelector('.unread-indicator');
            if (indicator) indicator.classList.add('visible');
        }
    }
}

export function sendMessage() {
    const input = document.getElementById('chat-input');
    const messageText = input.value.trim();

    if (messageText === '') return;

    const activeChannelItem = document.querySelector('.chat-list .chat-item.active');
    if (!activeChannelItem) return;

    const channelId = activeChannelItem.dataset.channel;
    
    // Check mod handlers
    if (window.__modMessageHandlers) {
        for (const modHandler of window.__modMessageHandlers) {
            try {
                const result = modHandler.handler({ 
                    text: messageText, 
                    author: player.name,
                    channelId 
                });
                if (result === false) {
                    // Mod prevented message
                    input.value = '';
                    return;
                }
            } catch (error) {
                console.error('Mod handler error:', error);
            }
        }
    }
    
    const messageData = createMessageDataObject(player.name, messageText);

    addMessageToChannel(channelId, messageData);

    input.value = '';
    input.focus();

    // Track player message for engagement system
    import('./bot.js').then(({ trackPlayerMessage }) => {
        trackPlayerMessage(messageText);
    });
}