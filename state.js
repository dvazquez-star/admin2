export const participants = [];
export const channels = {}; // Store messages for each channel

export const player = {
    name: "Admin",
    avatar: '/user-icon.png',
    role: 'Admin'
};

// To track admin actions for bot reactions
export const recentAdminActions = [];

// Game settings
export const gameSettings = {
    violatorsEnabled: true,
    bossesEnabled: true
};

// Presence states for realistic participant behavior
export const presenceStates = {
    ONLINE: 'online',      // Active, responds quickly
    ACTIVE: 'active',      // Very active, responds immediately
    AFK: 'afk',           // Away, slow or no response
    OFFLINE: 'offline'     // Not in chat
};

// Track participant engagement
export const participantEngagement = new Map(); // username -> { lastMessageTime, lastResponseTime, ignored: boolean }