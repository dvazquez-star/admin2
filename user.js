import { participants, player } from './state.js';
import { currentLanguage, translations } from './translation.js';

function updateParticipantsCount() {
    const label = translations[currentLanguage]?.members || 'Members';
    document.getElementById('participants-count').textContent = `${label} - ${participants.length}`;
}

export function renderParticipants() {
    const list = document.getElementById('participants-list');
    list.innerHTML = '';
    participants.forEach(p => {
        const li = document.createElement('li');
        li.className = 'participant-item';
        li.innerHTML = `<img src="${p.avatar}" alt="${p.name}"><span class="username">${p.name}${p.role==='Admin' ? ' <span class="admin-tag">ADMIN</span>' : ''}</span>`;
        list.appendChild(li);
    });
    updateParticipantsCount();
}

export async function generateUsers() {
    participants.length = 0;
    participants.push({ ...player });
    const total = Math.floor(Math.random() * 16) + 5; // 5..20
    const needed = Math.max(0, total - 1);
    let names = [];
    try {
        const completion = await websim.chat.completions.create({
            messages: [
                { role: 'system', content: `Generate ${needed} distinct, realistic social media usernames in English. Short, human-like, no spaces, 3-16 chars, mix of letters/numbers optionally. Respond ONLY as: {"users":["name1","name2",...]}` },
                { role: 'user', content: `${needed} unique usernames, no duplicates, no quotes inside names.` }
            ],
            json: true
        });
        const res = JSON.parse(completion.content);
        names = Array.isArray(res.users) ? res.users : [];
    } catch {}
    if (names.length < needed) {
        const pool = ['Nova', 'Pixel', 'Echo', 'Rogue', 'Vibe', 'Atlas', 'Luna', 'Drift', 'Aero', 'Kai', 'Ivy', 'Zed', 'Mira', 'Flux', 'Juno', 'Zen', 'Astra', 'Quinn', 'Bolt', 'Skye'];
        while (names.length < needed) {
            const base = pool[Math.floor(Math.random()*pool.length)];
            const num = Math.random()<0.5 ? '' : Math.floor(Math.random()*999);
            const candidate = (base + num).slice(0,16);
            if (!names.includes(candidate) && candidate.toLowerCase() !== player.name.toLowerCase()) names.push(candidate);
        }
    }
    const personalities = ['Gamer', 'Tech Enthusiast', 'Meme Lord', 'Casual Chatter', 'Helpful Senior Member', 'Artist', 'Musician', 'Programmer', 'Shitposter', 'Newbie', 'Know-it-all', 'Troll', 'Drama Queen'];
    const moods = ['happy', 'neutral', 'angry', 'sad', 'excited', 'bored', 'annoyed', 'friendly', 'hostile'];
    const styles = ['casual', 'formal', 'sarcastic', 'friendly', 'aggressive', 'passive', 'humorous', 'serious'];
    
    names.slice(0, needed).forEach(n => {
        const personality = personalities[Math.floor(Math.random() * personalities.length)];
        const mood = moods[Math.floor(Math.random() * moods.length)];
        const style = styles[Math.floor(Math.random() * styles.length)];
        const ruleBreaker = Math.random() < 0.3; // 30% chance
        const conflictProne = Math.random() < 0.25; // 25% chance
        
        // Presence states: initially some online, some offline
        const initialPresence = Math.random() < 0.6 ? 'online' : 'offline';
        
        participants.push({ 
            name: n, 
            avatar: '/user-icon.png', 
            role: 'Member', 
            personality,
            mood,
            communicationStyle: style,
            ruleBreaker,
            conflictProne,
            activityLevel: Math.random(), // 0-1, how often they speak
            warnings: 0, 
            isMuted: false,
            presence: initialPresence, // online/active/afk/offline
            lastSeen: Date.now(),
            responseSpeed: Math.random() * 0.5 + 0.5 // 0.5-1.0 multiplier for delays
        });
    });
    renderParticipants();
}