import { channels, participants, player, recentAdminActions, gameSettings, presenceStates, participantEngagement } from './state.js';
import { currentLanguage } from './translation.js';
import { createMessageDataObject, addMessageToChannel } from './message.js';

let chatSimulationInterval;
let presenceManagementInterval;
const botMessageHistory = new Map(); // Short-term message history
const botLongTermMemory = new Map(); // Long-term conversation memory
const botRelationships = new Map(); // Bot relationships with other users
const botTopicInterests = new Map(); // What topics each bot cares about
const botEmotionalState = new Map(); // Current emotional state
const ongoingConversations = new Map(); // Track active conversations
const typingUsers = new Set();
const channelTopics = new Map(); // What each channel is currently discussing

export function stopChatSimulation() {
    if (chatSimulationInterval) {
        clearInterval(chatSimulationInterval);
        chatSimulationInterval = null;
    }
    if (presenceManagementInterval) {
        clearInterval(presenceManagementInterval);
        presenceManagementInterval = null;
    }
    const typingIndicator = document.getElementById('typing-indicator');
    typingIndicator.innerHTML = '';
    typingIndicator.style.visibility = 'hidden';
    typingUsers.clear();
}

export function scheduleNextBotMessage() {
    stopChatSimulation();
    
    // Initialize AI systems for all bots
    initializeBotIntelligence();
    
    // Run multiple simulation layers
    chatSimulationInterval = setInterval(() => {
        runRealisticChatSimulation();
        manageConversationFlow();
        updateEmotionalStates();
    }, 2000);
    
    presenceManagementInterval = setInterval(managePresenceStates, 8000);
    
    // Proactive conversation starters
    setInterval(initiateProactiveConversations, 15000);
}

// Initialize bot intelligence systems
function initializeBotIntelligence() {
    const bots = participants.filter(p => p.role !== 'Admin');
    
    bots.forEach(bot => {
        // Initialize memory
        if (!botLongTermMemory.has(bot.name)) {
            botLongTermMemory.set(bot.name, {
                conversationHistory: [],
                importantEvents: [],
                learnedPreferences: {}
            });
        }
        
        // Initialize relationships
        if (!botRelationships.has(bot.name)) {
            const relationships = {};
            bots.forEach(other => {
                if (other.name !== bot.name) {
                    relationships[other.name] = {
                        affinity: Math.random() * 2 - 1, // -1 to 1
                        interactions: 0,
                        lastInteraction: null
                    };
                }
            });
            botRelationships.set(bot.name, relationships);
        }
        
        // Initialize topic interests
        if (!botTopicInterests.has(bot.name)) {
            const topics = generateTopicInterests(bot);
            botTopicInterests.set(bot.name, topics);
        }
        
        // Initialize emotional state
        if (!botEmotionalState.has(bot.name)) {
            botEmotionalState.set(bot.name, {
                currentMood: bot.mood,
                energy: Math.random(),
                engagement: Math.random(),
                lastMoodChange: Date.now()
            });
        }
    });
}

function generateTopicInterests(bot) {
    const topicsByPersonality = {
        'Gamer': ['gaming', 'esports', 'new releases', 'speedruns', 'mods'],
        'Tech Enthusiast': ['technology', 'programming', 'AI', 'gadgets', 'coding'],
        'Meme Lord': ['memes', 'jokes', 'viral content', 'trends', 'funny videos'],
        'Casual Chatter': ['weather', 'life', 'random thoughts', 'daily stuff'],
        'Artist': ['art', 'drawing', 'design', 'creativity', 'animation'],
        'Musician': ['music', 'songs', 'instruments', 'concerts', 'bands'],
        'Programmer': ['code', 'algorithms', 'languages', 'debugging', 'projects']
    };
    
    const baseTopics = topicsByPersonality[bot.personality] || ['general', 'chat', 'discussion'];
    return baseTopics.map(topic => ({
        name: topic,
        interest: Math.random() * 0.5 + 0.5 // 0.5 to 1.0
    }));
}

// Dynamic presence management
async function managePresenceStates() {
    const now = Date.now();
    const bots = participants.filter(p => p.role !== 'Admin');
    
    for (const bot of bots) {
        const timeSinceLastSeen = (now - bot.lastSeen) / 1000;
        const engagement = participantEngagement.get(bot.name) || { ignored: false, lastMessageTime: 0 };
        const emotional = botEmotionalState.get(bot.name);
        
        // Complex state transitions based on multiple factors
        const shouldBeActive = ongoingConversations.has(bot.name) || 
                             emotional?.engagement > 0.7;
        
        if (bot.presence === 'offline') {
            // Come online based on time and personality
            const onlineChance = bot.activityLevel * 0.1;
            if (Math.random() < onlineChance) {
                bot.presence = 'online';
                bot.lastSeen = now;
                
                const activeChannelItem = document.querySelector('.chat-list .chat-item.active');
                if (activeChannelItem && Math.random() < 0.4) {
                    const channelId = activeChannelItem.dataset.channel;
                    const joinMessage = createMessageDataObject(null, `${bot.name} joined the chat`, null, true);
                    addMessageToChannel(channelId, joinMessage);
                }
            }
        } else if (bot.presence === 'online') {
            if (shouldBeActive) {
                bot.presence = 'active';
            } else if (timeSinceLastSeen > 180 && Math.random() < 0.3) {
                bot.presence = 'afk';
            } else if (engagement.ignored && Math.random() < 0.2) {
                bot.presence = 'offline';
            }
        } else if (bot.presence === 'active') {
            if (!shouldBeActive && timeSinceLastSeen > 90) {
                bot.presence = 'online';
            }
        } else if (bot.presence === 'afk') {
            if (Math.random() < 0.15) {
                bot.presence = Math.random() < 0.6 ? 'online' : 'offline';
            }
        }
    }
}

// Update emotional states dynamically
function updateEmotionalStates() {
    const bots = participants.filter(p => p.role !== 'Admin');
    
    bots.forEach(bot => {
        const emotional = botEmotionalState.get(bot.name);
        if (!emotional) return;
        
        // Natural mood drift
        const timeSinceChange = Date.now() - emotional.lastMoodChange;
        if (timeSinceChange > 120000) { // 2 minutes
            if (Math.random() < 0.1) {
                const moods = ['happy', 'neutral', 'bored', 'excited', 'friendly'];
                emotional.currentMood = moods[Math.floor(Math.random() * moods.length)];
                emotional.lastMoodChange = Date.now();
                bot.mood = emotional.currentMood;
            }
        }
        
        // Energy decay
        emotional.energy = Math.max(0.1, emotional.energy - 0.01);
        
        // Engagement decay
        emotional.engagement = Math.max(0, emotional.engagement - 0.02);
    });
}

// Initiate proactive conversations
async function initiateProactiveConversations() {
    const activeChannelItem = document.querySelector('.chat-list .chat-item.active');
    if (!activeChannelItem) return;
    
    const channelId = activeChannelItem.dataset.channel;
    const channelHistory = channels[channelId] || [];
    
    // Don't interrupt ongoing conversations
    const recentMessages = channelHistory.slice(-3);
    const timeSinceLastMessage = recentMessages.length > 0 
        ? Date.now() - new Date(recentMessages[recentMessages.length - 1].timestamp).getTime()
        : 999999;
    
    if (timeSinceLastMessage < 10000) return; // Less than 10 seconds
    
    const bots = participants.filter(p => 
        p.role !== 'Admin' && 
        !p.isMuted && 
        (p.presence === 'online' || p.presence === 'active') &&
        !typingUsers.has(p.name)
    );
    
    if (bots.length === 0) return;
    
    // Select proactive bot based on energy
    const energeticBots = bots.filter(b => {
        const emotional = botEmotionalState.get(b.name);
        return emotional && emotional.energy > 0.6;
    });
    
    if (energeticBots.length === 0 || Math.random() > 0.15) return;
    
    const bot = energeticBots[Math.floor(Math.random() * energeticBots.length)];
    
    typingUsers.add(bot.name);
    
    try {
        const topics = botTopicInterests.get(bot.name) || [];
        const favoriteTopics = topics.filter(t => t.interest > 0.7).map(t => t.name);
        
        const prompt = `You are ${bot.name} (${bot.personality}, ${bot.mood}).
The chat has been quiet. You want to start a conversation.
${favoriteTopics.length > 0 ? `Your interests: ${favoriteTopics.join(', ')}` : ''}
Start a conversation naturally:
- Ask a question
- Share a random thought
- Mention something you're doing
- React to something from earlier

Be brief (1-12 words), casual, and natural:`;

        const completion = await websim.chat.completions.create({
            messages: [
                { role: 'system', content: 'You are human starting a casual conversation. Be natural and brief.' },
                { role: 'user', content: prompt }
            ],
            temperature: 0.9
        });
        
        const messageText = completion.content.trim();
        if (messageText) {
            bot.lastSeen = Date.now();
            const emotional = botEmotionalState.get(bot.name);
            if (emotional) {
                emotional.energy -= 0.2;
                emotional.engagement += 0.3;
            }
            
            const messageData = createMessageDataObject(bot.name, messageText);
            addMessageToChannel(channelId, messageData);
            
            // Update topic tracking
            updateChannelTopic(channelId, messageText);
        }
    } catch (error) {
        console.error("Proactive conversation failed:", error);
    } finally {
        typingUsers.delete(bot.name);
    }
}

// Manage conversation flow between bots
async function manageConversationFlow() {
    const activeChannelItem = document.querySelector('.chat-list .chat-item.active');
    if (!activeChannelItem) return;
    
    const channelId = activeChannelItem.dataset.channel;
    const channelHistory = channels[channelId] || [];
    const recentMessages = channelHistory.slice(-5);
    
    if (recentMessages.length < 2) return;
    
    // Detect if conversation is dying and boost engagement
    const lastMessage = recentMessages[recentMessages.length - 1];
    const secondLastMessage = recentMessages[recentMessages.length - 2];
    
    if (lastMessage && !lastMessage.isSystemMessage && 
        lastMessage.author !== player.name &&
        Math.random() < 0.3) {
        
        const bots = participants.filter(p => 
            p.role !== 'Admin' && 
            !p.isMuted && 
            p.presence !== 'offline' &&
            p.name !== lastMessage.author &&
            !typingUsers.has(p.name)
        );
        
        // Find bots who would naturally respond
        const interestedBots = bots.filter(bot => {
            const relationships = botRelationships.get(bot.name);
            const affinity = relationships?.[lastMessage.author]?.affinity || 0;
            
            // Check topic interest
            const topics = botTopicInterests.get(bot.name) || [];
            const messageTopicMatch = topics.some(t => 
                lastMessage.text.toLowerCase().includes(t.name.toLowerCase())
            );
            
            return affinity > -0.3 || messageTopicMatch || Math.random() < 0.2;
        });
        
        if (interestedBots.length > 0 && Math.random() < 0.4) {
            const responder = interestedBots[Math.floor(Math.random() * interestedBots.length)];
            
            // Create natural conversation
            setTimeout(() => {
                respondToMessage(responder, lastMessage, channelId);
            }, calculateRealisticDelay(responder, recentMessages));
        }
    }
}

// Enhanced message response with relationship awareness
async function respondToMessage(bot, messageToRespondTo, channelId) {
    if (typingUsers.has(bot.name)) return;
    typingUsers.add(bot.name);
    
    const isTypingInActiveChannel = document.querySelector('.chat-list .chat-item.active')?.dataset.channel === channelId;
    const typingIndicator = document.getElementById('typing-indicator');
    
    if (isTypingInActiveChannel) {
        typingIndicator.innerHTML = `<span>${bot.name} is typing</span><span class="typing-dots"><span>.</span><span>.</span><span>.</span></span>`;
        typingIndicator.style.visibility = 'visible';
    }
    
    try {
        const relationships = botRelationships.get(bot.name);
        const affinity = relationships?.[messageToRespondTo.author]?.affinity || 0;
        const memory = botLongTermMemory.get(bot.name);
        const emotional = botEmotionalState.get(bot.name);
        
        const relationshipContext = affinity > 0.5 ? 'You like this person' :
                                   affinity < -0.5 ? 'You don\'t like this person' :
                                   'You\'re neutral about this person';
        
        const recentHistory = memory?.conversationHistory.slice(-10).join('\n') || '';
        
        const prompt = `You are ${bot.name} (${bot.personality}, mood: ${emotional?.currentMood || bot.mood}).
${messageToRespondTo.author} just said: "${messageToRespondTo.text}"
${relationshipContext}.
Your energy: ${Math.round((emotional?.energy || 0.5) * 100)}%

${recentHistory ? `Recent context:\n${recentHistory}\n` : ''}

Respond naturally. Consider:
- Your relationship with them
- Your current mood and energy
- Whether you agree/disagree
- If you want to ask a question or share opinion

Write ONE realistic response (1-20 words):`;

        const completion = await websim.chat.completions.create({
            messages: [
                { role: 'system', content: 'You are human. Respond authentically based on your relationship and mood.' },
                { role: 'user', content: prompt }
            ],
            temperature: 0.85
        });
        
        const messageText = completion.content.trim();
        
        if (messageText) {
            bot.lastSeen = Date.now();
            
            // Update relationship
            if (relationships && relationships[messageToRespondTo.author]) {
                relationships[messageToRespondTo.author].interactions++;
                relationships[messageToRespondTo.author].lastInteraction = Date.now();
                // Small affinity boost for interaction
                relationships[messageToRespondTo.author].affinity += Math.random() * 0.05;
            }
            
            // Update memory
            if (memory) {
                memory.conversationHistory.push(`${messageToRespondTo.author}: ${messageToRespondTo.text}`);
                memory.conversationHistory.push(`${bot.name}: ${messageText}`);
                if (memory.conversationHistory.length > 50) {
                    memory.conversationHistory = memory.conversationHistory.slice(-50);
                }
            }
            
            // Update emotional state
            if (emotional) {
                emotional.engagement = Math.min(1, emotional.engagement + 0.2);
                emotional.energy = Math.max(0.1, emotional.energy - 0.1);
            }
            
            const messageData = createMessageDataObject(bot.name, messageText);
            addMessageToChannel(channelId, messageData);
            
            // Track ongoing conversation
            ongoingConversations.set(bot.name, {
                with: messageToRespondTo.author,
                started: Date.now()
            });
            
            // Clean up old conversations
            setTimeout(() => {
                if (ongoingConversations.get(bot.name)?.started === ongoingConversations.get(bot.name)?.started) {
                    ongoingConversations.delete(bot.name);
                }
            }, 30000);
        }
    } catch (error) {
        console.error("Response generation failed:", error);
    } finally {
        if (isTypingInActiveChannel) {
            typingIndicator.style.visibility = 'hidden';
            typingIndicator.innerHTML = '';
        }
        typingUsers.delete(bot.name);
    }
}

// Update channel topic tracking
function updateChannelTopic(channelId, messageText) {
    const currentTopic = channelTopics.get(channelId) || { topic: '', confidence: 0, updated: 0 };
    
    // Simple topic extraction (could be enhanced with AI)
    const words = messageText.toLowerCase().split(' ').filter(w => w.length > 4);
    if (words.length > 0) {
        currentTopic.topic = words[0];
        currentTopic.confidence = Math.min(1, currentTopic.confidence + 0.1);
        currentTopic.updated = Date.now();
        channelTopics.set(channelId, currentTopic);
    }
}

// Main realistic chat simulation with enhanced AI
async function runRealisticChatSimulation() {
    const allChannelIds = Object.keys(channels);
    if (allChannelIds.length === 0) return;
    
    const activeChannelItem = document.querySelector('.chat-list .chat-item.active');
    const activeChannelId = activeChannelItem ? activeChannelItem.dataset.channel : null;
    const channelId = (activeChannelId && Math.random() < 0.85) 
        ? activeChannelId 
        : allChannelIds[Math.floor(Math.random() * allChannelIds.length)];
    
    const channelElement = document.querySelector(`.chat-list .chat-item[data-channel="${channelId}"]`);
    if (!channelElement) return;

    const channelName = channelElement.dataset.channelName;
    const channelHistory = channels[channelId] || [];
    const recentMessages = channelHistory.slice(-15);
    
    // Advanced AI decision system
    const decision = await makeIntelligentResponseDecision(recentMessages, channelName);
    
    if (!decision.shouldRespond) return;
    
    const respondingBot = selectIntelligentResponder(recentMessages, decision, channelId);
    if (!respondingBot) return;
    
    typingUsers.add(respondingBot.name);

    const delay = calculateRealisticDelay(respondingBot, recentMessages);
    
    const isTypingInActiveChannel = activeChannelItem && activeChannelItem.dataset.channel === channelId;
    const typingIndicator = document.getElementById('typing-indicator');
    
    if (isTypingInActiveChannel) {
        typingIndicator.innerHTML = `<span>${respondingBot.name} is typing</span><span class="typing-dots"><span>.</span><span>.</span><span>.</span></span>`;
        typingIndicator.style.visibility = 'visible';
    }

    await new Promise(resolve => setTimeout(resolve, delay));

    try {
        const messageText = await generateIntelligentMessage(respondingBot, channelName, recentMessages, decision);
        
        if (messageText && messageText.trim()) {
            respondingBot.lastSeen = Date.now();
            
            // Update all AI systems
            updateBotMemory(respondingBot, messageText, recentMessages);
            updateBotEmotions(respondingBot, messageText);
            updateBotRelationships(respondingBot, recentMessages);
            
            const messageData = createMessageDataObject(respondingBot.name, messageText);
            addMessageToChannel(channelId, messageData);
            
            updateChannelTopic(channelId, messageText);
        }

    } catch (error) {
        console.error("AI message generation failed:", error);
    } finally {
        if (isTypingInActiveChannel) {
            typingIndicator.style.visibility = 'hidden';
            typingIndicator.innerHTML = '';
        }
        typingUsers.delete(respondingBot.name);
    }
}

// Make intelligent decision about responding
async function makeIntelligentResponseDecision(recentMessages, channelName) {
    if (recentMessages.length === 0) {
        return { shouldRespond: Math.random() < 0.08, reason: 'initiate', responderType: 'proactive' };
    }
    
    const lastMessages = recentMessages.slice(-4).map(m => 
        `${m.author}: ${m.text}`
    ).join('\n');
    
    const onlineParticipants = participants.filter(p => 
        p.role !== 'Admin' && 
        !p.isMuted && 
        (p.presence === 'online' || p.presence === 'active')
    );
    
    if (onlineParticipants.length === 0) {
        return { shouldRespond: false };
    }

    try {
        const completion = await websim.chat.completions.create({
            messages: [
                {
                    role: 'system',
                    content: `Analyze chat context with EXTREME selectivity.
Respond JSON: {"should_respond": true/false, "reason": "explanation", "responder_type": "active/interested/mentioned/none", "conversation_quality": 0-10}

CRITICAL: Respond TRUE only if:
- Direct question asked
- Topic highly engaging
- Natural conversation flow continuing
- Someone mentioned specifically
- Emotional response warranted

Respond FALSE (most common) if:
- Just statements with no hooks
- Topic exhausted
- Too many recent messages
- Low engagement potential
- Natural conversation pause

Quality matters: Only respond to high-quality conversation opportunities (7+/10).`
                },
                {
                    role: 'user',
                    content: `Channel: ${channelName}
Last messages:
${lastMessages}

${onlineParticipants.length} online. Should anyone respond? Be selective.`
                }
            ],
            json: true,
            temperature: 0.7
        });
        
        const decision = JSON.parse(completion.content);
        return {
            shouldRespond: decision.should_respond && (decision.conversation_quality || 5) >= 6,
            reason: decision.reason || 'unknown',
            responderType: decision.responder_type || 'none',
            quality: decision.conversation_quality || 0
        };
        
    } catch (error) {
        console.error("Response decision failed:", error);
        return { shouldRespond: Math.random() < 0.15, reason: 'fallback' };
    }
}

// Select responder using advanced AI and relationships
function selectIntelligentResponder(recentMessages, decision, channelId) {
    const bots = participants.filter(p => 
        p.role !== 'Admin' && 
        !p.isMuted && 
        (p.presence === 'online' || p.presence === 'active') &&
        !typingUsers.has(p.name)
    );
    
    if (bots.length === 0) return null;
    
    const now = Date.now();
    const lastMessage = recentMessages[recentMessages.length - 1];
    
    // Priority 1: Direct mentions
    const mentioned = bots.filter(b => lastMessage?.text?.includes(`@${b.name}`));
    if (mentioned.length > 0) {
        const bot = mentioned[0];
        bot.presence = 'active';
        const emotional = botEmotionalState.get(bot.name);
        if (emotional) emotional.engagement = 1.0;
        return bot;
    }
    
    // Priority 2: Topic interest match
    const topicMatches = bots.filter(bot => {
        const topics = botTopicInterests.get(bot.name) || [];
        return topics.some(t => 
            t.interest > 0.6 && 
            recentMessages.some(m => m.text?.toLowerCase().includes(t.name.toLowerCase()))
        );
    });
    
    if (topicMatches.length > 0 && Math.random() < 0.7) {
        return topicMatches[Math.floor(Math.random() * topicMatches.length)];
    }
    
    // Priority 3: Ongoing conversations
    const inConversation = bots.filter(b => {
        const conv = ongoingConversations.get(b.name);
        return conv && (now - conv.started) < 60000;
    });
    
    if (inConversation.length > 0 && Math.random() < 0.5) {
        return inConversation[Math.floor(Math.random() * inConversation.length)];
    }
    
    // Priority 4: Relationship-based + emotional state + activity
    const weightedBots = bots.map(bot => {
        let weight = bot.activityLevel * 10;
        
        const emotional = botEmotionalState.get(bot.name);
        if (emotional) {
            weight *= (emotional.engagement * 2 + emotional.energy);
        }
        
        if (bot.presence === 'active') weight *= 4;
        else if (bot.presence === 'afk') weight *= 0.05;
        
        // Relationship with last speaker
        if (lastMessage && !lastMessage.isSystemMessage) {
            const relationships = botRelationships.get(bot.name);
            const affinity = relationships?.[lastMessage.author]?.affinity || 0;
            weight *= (1 + affinity);
        }
        
        // Don't monopolize
        const recentBotMessages = recentMessages.filter(m => m.author === bot.name).length;
        if (recentBotMessages > 2) weight *= 0.2;
        
        const engagement = participantEngagement.get(bot.name);
        if (engagement?.ignored) weight *= 0.15;
        
        return { bot, weight: Math.max(0, weight) };
    });
    
    const totalWeight = weightedBots.reduce((sum, item) => sum + item.weight, 0);
    if (totalWeight === 0) return null;
    
    let random = Math.random() * totalWeight;
    for (const item of weightedBots) {
        random -= item.weight;
        if (random <= 0) return item.bot;
    }
    
    return weightedBots[0].bot;
}

function calculateRealisticDelay(bot, recentMessages) {
    const baseDelay = 3000;
    let multiplier = 1;
    
    const emotional = botEmotionalState.get(bot.name);
    if (emotional) {
        multiplier *= (2 - emotional.energy);
        if (emotional.currentMood === 'excited') multiplier *= 0.5;
        if (emotional.currentMood === 'bored') multiplier *= 1.8;
    }
    
    if (bot.presence === 'active') {
        multiplier *= (0.4 + Math.random() * 0.3);
    } else if (bot.presence === 'online') {
        multiplier *= (0.7 + Math.random() * 0.6);
    } else if (bot.presence === 'afk') {
        multiplier *= (2 + Math.random() * 2);
    }
    
    multiplier *= bot.responseSpeed;
    
    const lastMessage = recentMessages[recentMessages.length - 1];
    if (lastMessage?.text?.includes(`@${bot.name}`)) {
        multiplier *= 0.4;
    }
    
    return Math.floor(baseDelay * multiplier);
}

// Generate intelligent, context-aware message
async function generateIntelligentMessage(bot, channelName, channelHistory, decision) {
    const recentMessages = channelHistory.slice(-10);
    const memory = botLongTermMemory.get(bot.name);
    const emotional = botEmotionalState.get(bot.name);
    const topics = botTopicInterests.get(bot.name) || [];
    
    const conversationLog = recentMessages
        .filter(m => !m.isSystemMessage)
        .map(m => `${m.author}: ${m.text}`)
        .join('\n');

    const recentContext = memory?.conversationHistory.slice(-15).join('\n') || '';
    const importantEvents = memory?.importantEvents.slice(-3).join('. ') || '';
    
    // Find who bot is talking to
    const lastSpeaker = recentMessages.filter(m => !m.isSystemMessage).slice(-1)[0]?.author;
    const relationships = botRelationships.get(bot.name);
    const relationship = lastSpeaker && relationships ? relationships[lastSpeaker] : null;
    
    const relationshipContext = relationship 
        ? `Relationship with ${lastSpeaker}: ${
            relationship.affinity > 0.5 ? 'friendly' :
            relationship.affinity < -0.5 ? 'hostile' : 'neutral'
          } (${relationship.interactions} past interactions)`
        : '';

    const emotionalContext = `Mood: ${emotional?.currentMood || bot.mood}
Energy: ${Math.round((emotional?.energy || 0.5) * 100)}%
Engagement: ${Math.round((emotional?.engagement || 0.5) * 100)}%`;

    const topicContext = topics.length > 0 
        ? `Interests: ${topics.filter(t => t.interest > 0.6).map(t => t.name).join(', ')}`
        : '';

    const prompt = `You are ${bot.name}, a REAL human being.

**YOUR IDENTITY:**
- Personality: ${bot.personality}
- Style: ${bot.communicationStyle}
${topicContext}

**CURRENT STATE:**
${emotionalContext}
${relationshipContext}

**SITUATION:**
- Channel: #${channelName}
- Reason you're responding: ${decision.reason}
${importantEvents ? `- What you remember: ${importantEvents}` : ''}

**CURRENT CONVERSATION:**
${conversationLog || '(You are starting fresh)'}

${recentContext ? `**YOUR RECENT MESSAGES:**\n${recentContext}\n` : ''}

**YOUR TASK:**
Write ONE authentic message as yourself in ${currentLanguage}. Be REAL:

1. **Personality First**: Let your ${bot.personality} nature show
2. **Stay Natural**: Match the conversation's energy and topic
3. **Vary Length**: 
   - 70%: Ultra short (1-8 words) - "lol same", "wait what", "fr tho"
   - 25%: Medium (9-15 words)
   - 5%: Longer (16-25 words)
4. **Be Human**: typos ok, slang ok, incomplete sentences ok
5. **React Authentically**: Based on your mood and relationships
6. **Stay Relevant**: To #${channelName} and current topic

${bot.ruleBreaker ? '(You sometimes break rules - caps, spam emojis, etc)' : ''}
${bot.conflictProne ? '(You enjoy debates and might disagree)' : ''}

Write ONLY the message in ${currentLanguage}. No explanation, no quotes:`;

    try {
        const completion = await websim.chat.completions.create({
            messages: [
                { 
                    role: 'system', 
                    content: `You are a real human. Every message is unique. Be unpredictable, authentic, and natural. React to context, relationships, and emotions. No patterns, no templates.`
                },
                { role: 'user', content: prompt }
            ],
            temperature: 0.95
        });

        let message = completion.content.trim();
        
        // Authentic post-processing
        if (bot.ruleBreaker && Math.random() < 0.25) {
            if (Math.random() < 0.3) {
                message = message.toUpperCase();
            } else if (Math.random() < 0.3) {
                message = message + '!'.repeat(Math.floor(Math.random() * 4) + 1);
            }
        }
        
        // Very rare typos for realism
        if (Math.random() < 0.1) {
            const words = message.split(' ');
            if (words.length > 2) {
                const typoIndex = Math.floor(Math.random() * words.length);
                const word = words[typoIndex];
                if (word.length > 3) {
                    const charIndex = Math.floor(Math.random() * word.length);
                    words[typoIndex] = word.slice(0, charIndex) + word.slice(charIndex + 1);
                    message = words.join(' ');
                }
            }
        }

        return message;
    } catch (error) {
        console.error("Message generation error:", error);
        return null;
    }
}

// Update bot's long-term memory
function updateBotMemory(bot, messageText, recentMessages) {
    const memory = botLongTermMemory.get(bot.name);
    if (!memory) return;
    
    memory.conversationHistory.push(`${bot.name}: ${messageText}`);
    if (memory.conversationHistory.length > 100) {
        memory.conversationHistory = memory.conversationHistory.slice(-100);
    }
    
    // Detect important events
    if (messageText.includes('?') || 
        messageText.length > 50 || 
        recentMessages.some(m => m.text?.includes(`@${bot.name}`))) {
        memory.importantEvents.push(`${new Date().toLocaleTimeString()}: ${messageText.substring(0, 50)}`);
        if (memory.importantEvents.length > 20) {
            memory.importantEvents = memory.importantEvents.slice(-20);
        }
    }
}

// Update emotional state based on message
function updateBotEmotions(bot, messageText) {
    const emotional = botEmotionalState.get(bot.name);
    if (!emotional) return;
    
    emotional.energy = Math.max(0.2, emotional.energy - 0.15);
    emotional.engagement = Math.min(1, emotional.engagement + 0.25);
    
    // Mood changes based on message content
    if (messageText.includes('!') && Math.random() < 0.3) {
        emotional.currentMood = 'excited';
        emotional.lastMoodChange = Date.now();
    } else if (messageText.includes('?') && Math.random() < 0.2) {
        emotional.currentMood = 'curious';
        emotional.lastMoodChange = Date.now();
    }
}

// Update relationships based on interactions
function updateBotRelationships(bot, recentMessages) {
    const relationships = botRelationships.get(bot.name);
    if (!relationships) return;
    
    recentMessages.forEach(msg => {
        if (msg.author && msg.author !== bot.name && !msg.isSystemMessage) {
            if (relationships[msg.author]) {
                // Gradual relationship changes
                const change = (Math.random() - 0.5) * 0.03;
                relationships[msg.author].affinity = Math.max(-1, Math.min(1, 
                    relationships[msg.author].affinity + change
                ));
            }
        }
    });
}

export function trackPlayerMessage(messageText) {
    const now = Date.now();
    const bots = participants.filter(p => p.role !== 'Admin' && p.presence !== 'offline');
    
    // Update all bots' relationship with player
    bots.forEach(bot => {
        const relationships = botRelationships.get(bot.name);
        if (relationships && !relationships[player.name]) {
            relationships[player.name] = {
                affinity: 0,
                interactions: 0,
                lastInteraction: null
            };
        }
    });
    
    setTimeout(() => {
        const mentioned = bots.filter(b => messageText.includes(`@${b.name}`));
        
        mentioned.forEach(bot => {
            const memory = botLongTermMemory.get(bot.name);
            if (memory) {
                memory.conversationHistory.push(`${player.name}: ${messageText}`);
            }
            
            const relationships = botRelationships.get(bot.name);
            if (relationships && relationships[player.name]) {
                relationships[player.name].interactions++;
                relationships[player.name].lastInteraction = now;
                relationships[player.name].affinity += 0.05;
            }
            
            const emotional = botEmotionalState.get(bot.name);
            if (emotional) {
                emotional.engagement = Math.min(1, emotional.engagement + 0.4);
                emotional.energy = Math.min(1, emotional.energy + 0.2);
            }
        });
    }, 1000);
}

export async function triggerWidespreadReaction(announcementText, channelId) {
    const bots = participants.filter(p => 
        p.role !== 'Admin' && 
        !p.isMuted && 
        p.presence !== 'offline'
    );
    
    const reactionCount = Math.floor(bots.length * (Math.random() * 0.4 + 0.3));
    const reactingBots = bots.sort(() => 0.5 - Math.random()).slice(0, reactionCount);

    for (let i = 0; i < reactingBots.length; i++) {
        const bot = reactingBots[i];
        const delay = calculateRealisticDelay(bot, []) + (i * 1500);
        
        setTimeout(async () => {
            try {
                const emotional = botEmotionalState.get(bot.name);
                const topics = botTopicInterests.get(bot.name) || [];
                
                const prompt = `You are ${bot.name} (${bot.personality}, ${emotional?.currentMood || bot.mood}). 
Admin announced: "${announcementText}"
React authentically and briefly (1-10 words) in ${currentLanguage}:`;

                const completion = await websim.chat.completions.create({
                    messages: [
                        { role: 'system', content: `You are human. React naturally to admin announcement in ${currentLanguage}.` },
                        { role: 'user', content: prompt }
                    ],
                    temperature: 0.9
                });
                
                bot.lastSeen = Date.now();
                bot.presence = 'active';
                
                const messageData = createMessageDataObject(bot.name, completion.content.trim());
                addMessageToChannel(channelId, messageData);
                
                updateBotMemory(bot, completion.content, []);
            } catch (error) {
                console.error("Bot announcement reaction failed:", error);
            }
        }, delay);
    }
}

export async function runVoteSimulation(question, options, channelId, duration) {
    const bots = participants.filter(p => 
        p.role !== 'Admin' && 
        !p.isMuted && 
        p.presence !== 'offline'
    );
    
    const discussionParticipants = bots.slice(0, Math.min(bots.length, Math.floor(bots.length * 0.7)));
    const voteData = { question, options, votes: {} };

    discussionParticipants.forEach(bot => {
        bot.presence = 'active';
        const emotional = botEmotionalState.get(bot.name);
        if (emotional) emotional.engagement = 1.0;
    });

    const discussionEndTime = Date.now() + (duration * 1000 * 0.7);
    const discussionMessages = Math.floor(discussionParticipants.length * 1.5);
    
    for (let i = 0; i < discussionMessages; i++) {
        setTimeout(async () => {
            if (Date.now() > discussionEndTime) return;
            
            const talkingBot = discussionParticipants[Math.floor(Math.random() * discussionParticipants.length)];
            const delay = calculateRealisticDelay(talkingBot, []);
            
            await new Promise(resolve => setTimeout(resolve, delay));
            
            try {
                const emotional = botEmotionalState.get(talkingBot.name);
                const memory = botLongTermMemory.get(talkingBot.name);
                
                const prompt = `You are ${talkingBot.name} (${talkingBot.personality}, ${emotional?.currentMood || 'neutral'}).
Voting on: "${question}"
Options: ${options.join(', ')}
Message ${i + 1}/${discussionMessages} - ${i < 3 ? 'Share initial opinion' : i < 6 ? 'Discuss with others' : 'Final thoughts'}
Be natural and brief (1-15 words) in ${currentLanguage}:`;

                const completion = await websim.chat.completions.create({
                    messages: [
                        { role: 'system', content: `You are human in vote discussion. Be natural. Speak in ${currentLanguage}.` },
                        { role: 'user', content: prompt }
                    ],
                    temperature: 0.9
                });
                
                talkingBot.lastSeen = Date.now();
                const messageText = completion.content.trim();
                const messageData = createMessageDataObject(talkingBot.name, messageText);
                addMessageToChannel(channelId, messageData);
                
                updateBotMemory(talkingBot, messageText, []);
            } catch (error) { 
                console.error("Vote discussion failed:", error); 
            }
        }, (i * 3000) + Math.random() * 2000);
    }

    setTimeout(() => {
        const systemMessage = createMessageDataObject(null, `⏱️ Voting ended: "${question}"`, null, true);
        addMessageToChannel(channelId, systemMessage);

        Promise.all(discussionParticipants.map(async (bot) => {
            try {
                const emotional = botEmotionalState.get(bot.name);
                const topics = botTopicInterests.get(bot.name) || [];
                
                const prompt = `You are ${bot.name} (${bot.personality}).
Based on your personality and discussion, choose ONE option.
Question: "${question}"
Options: ${options.map((o, i) => `${i + 1}. ${o}`).join('\n')}

Respond with ONLY the option text:`;

                const completion = await websim.chat.completions.create({
                    messages: [
                        { role: 'system', content: 'Choose ONE option based on personality. Reply with option text only.' },
                        { role: 'user', content: prompt }
                    ]
                });
                
                let chosenOption = completion.content.trim();
                const bestMatch = options.find(o => 
                    chosenOption.toLowerCase().includes(o.toLowerCase()) ||
                    o.toLowerCase().includes(chosenOption.toLowerCase())
                );
                
                if (bestMatch) {
                    voteData.votes[bestMatch] = (voteData.votes[bestMatch] || 0) + 1;
                } else {
                    const randomOption = options[Math.floor(Math.random() * options.length)];
                    voteData.votes[randomOption] = (voteData.votes[randomOption] || 0) + 1;
                }
            } catch (error) { 
                console.error("Bot voting failed:", error);
                const randomOption = options[Math.floor(Math.random() * options.length)];
                voteData.votes[randomOption] = (voteData.votes[randomOption] || 0) + 1;
            }
        })).then(() => {
            const results = options.map(option => ({
                option,
                count: voteData.votes[option] || 0
            }));
            const totalVotes = results.reduce((sum, r) => sum + r.count, 0);
            
            const resultMessageData = createMessageDataObject(null, `Vote Results`, null, true, 'vote_result', { question, results, totalVotes });
            addMessageToChannel(channelId, resultMessageData);
        });

    }, duration * 1000);
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
React briefly and naturally (1-10 words) in ${currentLanguage}. Show the ${emotion} emotion clearly.`;

        const completion = await websim.chat.completions.create({
            messages: [
                { role: 'system', content: `Express ${emotion} emotion naturally and briefly in ${currentLanguage}.` },
                { role: 'user', content: prompt }
            ]
        });

        const messageData = createMessageDataObject(userName, completion.content.trim());
        addMessageToChannel(channelId, messageData);
    } catch (error) {
        console.error("Force user reaction failed:", error);
    }
}

async function simulateDrama(dramaType, topic) {
    const activeChannelItem = document.querySelector('.chat-list .chat-item.active');
    if (!activeChannelItem) return;
    const channelId = activeChannelItem.dataset.channel;

    for (let i = 0; i < 6; i++) {
        setTimeout(async () => {
            const currentUser = i % 2 === 0 ? user1 : user2;
            const otherUser = i % 2 === 0 ? user2 : user1;

            try {
                const prompt = `You are ${currentUser.name} (${currentUser.personality}, ${currentUser.mood}).
You are in a ${dramaType} with ${otherUser.name}.
${topic ? `Topic: ${topic}` : ''}
Message ${i + 1}/6 - ${i < 2 ? 'Start the conflict' : i < 4 ? 'Escalate' : 'Calm down or continue'}
Write ONE brief, emotional message (1-15 words) in ${currentLanguage}:`;

                const completion = await websim.chat.completions.create({
                    messages: [
                        { role: 'system', content: `You are involved in ${dramaType}. Be emotional and realistic. Speak in ${currentLanguage}.` },
                        { role: 'user', content: prompt }
                    ]
                });

                const messageData = createMessageDataObject(currentUser.name, completion.content.trim());
                addMessageToChannel(channelId, messageData);
            } catch (error) {
                console.error("Simulate drama failed:", error);
            }
        }, (i * 3000) + Math.random() * 2000);
    }
}