import { channels, participants } from './state.js';
import { currentLanguage, translations } from './translation.js';
import { renderMessagesForChannel, createMessageDataObject } from './message.js';
import { playSound } from './audio.js';

const getChannelId = (name) => `ch-${encodeURIComponent(name.toLowerCase())}`;

async function prePopulateChannels(channelNames) {
    const bots = participants.filter(p => p.role !== 'Admin');
    if (bots.length === 0) return;
    
    // Create detailed bot personality descriptions
    const botDescriptions = bots.map(b => 
        `${b.name}: ${b.personality}, ${b.mood} mood, ${b.communicationStyle} style${b.ruleBreaker ? ', rule-breaker' : ''}${b.conflictProne ? ', argumentative' : ''}`
    ).join('\n');

    try {
        const completion = await websim.chat.completions.create({
            messages: [
                {
                    role: 'system',
                    content: `You generate REALISTIC historic chat logs for a new online community. Make it feel like real humans were chatting.

**CRITICAL INSTRUCTIONS:**
1. Create DIVERSE, UNIQUE messages - no patterns or repetition
2. Each person has a DISTINCT voice and personality
3. Messages must be STRICTLY relevant to the channel topic
4. Use informal tone, slang, emojis, typos, internet language
5. Vary message lengths: mostly short (1-10 words), some medium, rare long
6. Make it feel LIVED-IN and authentic

**Community Members:**
${botDescriptions}

**Channels & Topics:**
${channelNames.map(name => `- ${name}: Stay 100% on topic for ${name}`).join('\n')}

**Language:** ${currentLanguage}

**Message Variety Examples:**
- Ultra short: "lol", "fr", "same", "oof", "nice"
- Short: "wait what happened", "nah bro thats crazy", "anyone online?"
- Medium: "yo i just saw that new update its actually pretty good ngl"
- React naturally: some agree, some question, some joke

**Output Format:**
JSON object with channel names as keys, arrays of messages as values.
Each message: {"author": "Username", "text": "message"}

Example:
{
  "General": [
    {"author": "User1", "text": "yo"},
    {"author": "User2", "text": "whats good"}
  ]
}`
                },
                { 
                    role: 'user', 
                    content: `Generate realistic, DIVERSE chat history for: ${channelNames.join(', ')}. Make each person sound completely different. No repetitive patterns.` 
                }
            ],
            json: true,
            temperature: 0.9 // Higher temperature for more variety
        });

        const history = JSON.parse(completion.content);

        // Create case-insensitive lookup map
        const historyLookup = {};
        for (const key in history) {
            historyLookup[key.toLowerCase()] = history[key];
        }

        for (const channelName of channelNames) {
            const historyForChannel = historyLookup[channelName.toLowerCase()];
            if (historyForChannel && Array.isArray(historyForChannel)) {
                const dataChannel = getChannelId(channelName);
                channels[dataChannel] = historyForChannel.map(msg => {
                    const authorExists = bots.find(b => b.name === msg.author);
                    const authorName = authorExists ? msg.author : bots[Math.floor(Math.random() * bots.length)].name;
                    return createMessageDataObject(authorName, msg.text);
                });
            }
        }

    } catch (error) {
        console.error("Failed to pre-populate channels:", error);
    }
}

function renderChannels(channelNames) {
    const chatList = document.querySelector('.chat-list');
    chatList.innerHTML = '';

    // Initialize any channels that weren't pre-populated
    channelNames.forEach(name => {
        const dataChannel = getChannelId(name);
        if (!channels[dataChannel]) {
            channels[dataChannel] = [];
        }
    });

    channelNames.forEach((name, index) => {
        const dataChannel = getChannelId(name);

        const li = document.createElement('li');
        li.className = 'chat-item';
        if (index === 0) {
            li.classList.add('active');
            document.getElementById('current-channel-name').textContent = `# ${name}`;
        }
        li.dataset.channel = dataChannel;
        li.dataset.channelName = name;

        li.innerHTML = `
            <div class="channel-icon">#</div>
            <div class="chat-info">
                <span class="chat-name">${name}</span>
            </div>
            <div class="unread-indicator"></div>
        `;
        chatList.appendChild(li);
    });

    // Render messages for the initially active channel
    const firstChannel = document.querySelector('.chat-list .chat-item');
    if (firstChannel) {
        renderMessagesForChannel(firstChannel.dataset.channel);
    }

    setupChannelClickListeners();
}

function setupChannelClickListeners() {
    document.querySelectorAll('.chat-list .chat-item').forEach(item => {
        item.addEventListener('click', (e) => {
            const clickedChannel = e.currentTarget;
            if (clickedChannel.classList.contains('active')) return;

            document.querySelectorAll('.chat-list .chat-item').forEach(i => i.classList.remove('active'));
            clickedChannel.classList.add('active');

            const channelName = clickedChannel.dataset.channelName;
            document.getElementById('current-channel-name').textContent = `# ${channelName}`;

            const indicator = clickedChannel.querySelector('.unread-indicator');
            if (indicator) indicator.classList.remove('visible');

            // clear typing indicator on channel switch
            const typingIndicator = document.getElementById('typing-indicator');
            typingIndicator.style.visibility = 'hidden';
            typingIndicator.innerHTML = '';

            renderMessagesForChannel(clickedChannel.dataset.channel);
            playSound('click');
        });
    });
}

export async function generateChannels() {
    const chatList = document.querySelector('.chat-list');
    const loadingMessage = chatList.querySelector('.loading-message');
    if(loadingMessage) {
        loadingMessage.textContent = translations[currentLanguage]?.generatingChannels || "Generating channels...";
    } else {
        chatList.innerHTML = `<li class="loading-message">${translations[currentLanguage]?.generatingChannels || "Generating channels..."}</li>`;
    }

    // Clear existing channels data
    Object.keys(channels).forEach(key => delete channels[key]);

    const channelCount = Math.floor(Math.random() * (10 - 3 + 1)) + 3;

    try {
        const completion = await websim.chat.completions.create({
            messages: [
                {
                    role: "system",
                    content: `Generate ${channelCount} unique, single-word channel names in ${currentLanguage} for a tech-themed online community chat. The names should be relevant to topics like general discussion, memes, rules, tech, gaming, etc. Respond with a JSON object containing a "channels" array. Each item in the array should be an object with a "name" property. Example: {"channels": [{"name": "General"}, {"name": "Memes"}]}`
                },
                { role: "user", content: `Give me ${channelCount} channel names in ${currentLanguage}.` }
            ],
            json: true,
        });
        const result = JSON.parse(completion.content);
        if (result.channels && Array.isArray(result.channels)) {
            const channelNames = result.channels.map(c => c.name);
            await prePopulateChannels(channelNames);
            renderChannels(channelNames);
        } else {
            throw new Error("Invalid response format");
        }
    } catch (error) {
        console.error("AI Channel generation failed. Using fallback names.", error);
        const fallbackNames = ['General', 'Memes', 'Rules', 'Gaming', 'Off-topic'];
        await prePopulateChannels(fallbackNames);
        renderChannels(fallbackNames);
    }
}