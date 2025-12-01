import { participants, channels, player } from './state.js';
import { createMessageDataObject, addMessageToChannel } from './message.js';
import { playSound } from './audio.js';
import { showModal, hideModal } from './ui.js';

const room = new WebsimSocket();

let activeMods = [];
let currentEditingMod = null;
let logicNodes = [];
let logicConnections = [];
let modVariables = {};
let testConsoleOutput = [];
let modAssets = { images: [], sounds: [] };

export function initMods() {
    setupModsEventListeners();
    loadInstalledMods();
    loadModsFromDatabase();

    // Keep workshop and installed list in sync with database changes
    room.collection('mod').subscribe(() => {
        renderInstalledMods();
        loadModsFromDatabase();
    });
}

export function showModsScreen() {
    renderInstalledMods();
    loadModsFromDatabase();
}

export function hideModsScreen() {
    // Cleanup if needed
}

function setupModsEventListeners() {
    const modsScreen = document.getElementById('mods-screen');
    const createModBtn = document.getElementById('create-mod-btn');
    const closeEditorBtn = document.getElementById('close-mod-editor-btn');
    const saveModBtn = document.getElementById('save-mod-btn');
    const testModBtn = document.getElementById('test-mod-btn');

    createModBtn.addEventListener('click', () => {
        currentEditingMod = createNewMod();
        openModEditor(currentEditingMod);
    });

    closeEditorBtn.addEventListener('click', () => {
        hideModal(document.getElementById('mod-editor-modal'));
    });

    saveModBtn.addEventListener('click', saveCurrentMod);
    testModBtn.addEventListener('click', testCurrentMod);

    // Editor tabs
    document.querySelectorAll('.editor-tab').forEach(tab => {
        tab.addEventListener('click', () => switchEditorTab(tab.dataset.tab));
    });

    // Logic editor
    setupLogicEditor();

    // Commands
    document.getElementById('add-command-btn').addEventListener('click', addCommandEditor);

    // UI Elements
    document.getElementById('add-ui-element-btn').addEventListener('click', addUIElementEditor);

    // Mod detail modal
    document.getElementById('close-mod-detail-btn').addEventListener('click', () => {
        hideModal(document.getElementById('mod-detail-modal'));
    });
}

function createNewMod() {
    return {
        id: `mod_${Date.now()}`,
        name: 'New Mod',
        description: '',
        author: player.name,
        version: '1.0.0',
        enabled: false,
        published: false, // Add published flag
        logic: {
            nodes: [],
            connections: []
        },
        commands: [],
        events: {
            onMessageSent: '',
            onUserJoin: '',
            onUserLeave: '',
            onChannelChange: ''
        },
        uiElements: [],
        code: '',
        variables: {},
        assets: { images: [], sounds: [] }
    };
}

function openModEditor(mod) {
    currentEditingMod = mod;

    // Populate fields
    document.getElementById('mod-name-input').value = mod.name;
    document.getElementById('mod-description-input').value = mod.description;
    document.getElementById('mod-author-input').value = mod.author;
    document.getElementById('mod-version-input').value = mod.version;

    // Add publish button to Info tab
    const infoTab = document.getElementById('editor-tab-info');
    const existingPublishBtn = infoTab.querySelector('.publish-status-btn');
    if (existingPublishBtn) existingPublishBtn.remove();
    
    const publishBtn = document.createElement('button');
    publishBtn.className = 'menu-button publish-status-btn';
    publishBtn.style.cssText = `
        margin-top: 1.5rem;
        width: 100%;
        opacity: 1;
        font-size: 1.2rem;
        padding: 1rem;
        display: block;
    `;
    
    if (mod.published) {
        publishBtn.textContent = '🔒 Unpublish Mod';
        publishBtn.style.background = 'rgba(220, 53, 69, 0.3)';
        publishBtn.style.borderColor = '#dc3545';
        publishBtn.style.color = '#dc3545';
    } else {
        publishBtn.textContent = '🌐 Publish Mod';
        publishBtn.style.background = 'rgba(46, 204, 113, 0.3)';
        publishBtn.style.borderColor = '#2ecc71';
        publishBtn.style.color = '#2ecc71';
    }
    
    publishBtn.addEventListener('click', async () => {
        // Save current state first
        await saveCurrentModData();
        
        // Get latest from DB
        const allMods = room.collection('mod').getList();
        const dbMod = allMods.find(m => m.modId === currentEditingMod.modId);
        
        if (!dbMod) {
            alert('Please save the mod first');
            return;
        }

        const newPublishState = !dbMod.published;
        
        if (newPublishState) {
            if (!confirm(`Publish "${dbMod.name}"? It will be available to all users.`)) return;
        } else {
            if (!confirm(`Unpublish "${dbMod.name}"? It will no longer be visible to others.`)) return;
        }
        
        try {
            await room.collection('mod').update(dbMod.id, { published: newPublishState });
            currentEditingMod.published = newPublishState;
            alert(newPublishState ? 'Mod published successfully! 🌐' : 'Mod unpublished');
            
            // Refresh the button
            hideModal(document.getElementById('mod-editor-modal'));
            setTimeout(() => openModEditor(currentEditingMod), 100);
        } catch (error) {
            console.error('Failed to toggle publish state:', error);
            alert('Failed to update publish state');
        }
    });
    
    infoTab.appendChild(publishBtn);

    // Load logic
    logicNodes = mod.logic?.nodes || [];
    logicConnections = mod.logic?.connections || [];
    renderLogicCanvas();

    // Load commands
    renderCommandsEditor(mod.commands || []);

    // Load events
    const eventHandlers = document.querySelectorAll('.event-code');
    eventHandlers[0].value = mod.events?.onMessageSent || '';
    eventHandlers[1].value = mod.events?.onUserJoin || '';
    eventHandlers[2].value = mod.events?.onUserLeave || '';
    eventHandlers[3].value = mod.events?.onChannelChange || '';

    // Load UI elements
    renderUIElementsEditor(mod.uiElements || []);

    // Load code
    document.getElementById('mod-code-editor').value = mod.code || '';

    // Load variables
    modVariables = mod.variables || {};
    renderVariablesTab();

    // Load assets
    modAssets = mod.assets || { images: [], sounds: [] };
    renderAssetsTab();

    // Load templates
    renderTemplatesTab();

    // Setup testing console
    setupTestingConsole();

    showModal(document.getElementById('mod-editor-modal'));
}

function switchEditorTab(tabName) {
    document.querySelectorAll('.editor-tab').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.editor-tab-content').forEach(content => content.classList.remove('active'));

    document.querySelector(`.editor-tab[data-tab="${tabName}"]`).classList.add('active');
    document.getElementById(`editor-tab-${tabName}`).classList.add('active');

    if (tabName === 'templates') {
        renderTemplatesTab();
    } else if (tabName === 'variables') {
        renderVariablesTab();
    } else if (tabName === 'assets') {
        renderAssetsTab();
    } else if (tabName === 'testing') {
        renderTestingTab();
    } else if (tabName === 'snippets') {
        renderSnippetsTab();
    } else if (tabName === 'documentation') {
        renderDocumentationTab();
    }
}

// Logic Editor
function setupLogicEditor() {
    const canvas = document.getElementById('logic-canvas');
    const toolbar = document.querySelectorAll('.logic-tool-btn');

    toolbar.forEach(btn => {
        btn.addEventListener('click', () => {
            const nodeType = btn.dataset.node;
            addLogicNode(nodeType);
        });
    });

    // Connection drawing
    let connectionStart = null;
    let tempConnection = null;

    canvas.addEventListener('mousedown', (e) => {
        if (e.target.classList.contains('logic-port-out')) {
            const nodeEl = e.target.closest('.logic-node');
            connectionStart = {
                nodeId: nodeEl.dataset.nodeId,
                x: e.target.getBoundingClientRect().left + e.target.offsetWidth / 2 - canvas.getBoundingClientRect().left,
                y: e.target.getBoundingClientRect().top + e.target.offsetHeight / 2 - canvas.getBoundingClientRect().top
            };
            
            tempConnection = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            tempConnection.setAttribute('stroke', '#00ffff');
            tempConnection.setAttribute('stroke-width', '2');
            tempConnection.setAttribute('x1', connectionStart.x);
            tempConnection.setAttribute('y1', connectionStart.y);
            tempConnection.setAttribute('x2', connectionStart.x);
            tempConnection.setAttribute('y2', connectionStart.y);
            
            let svg = canvas.querySelector('svg');
            if (!svg) {
                svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
                svg.style.position = 'absolute';
                svg.style.top = '0';
                svg.style.left = '0';
                svg.style.width = '100%';
                svg.style.height = '100%';
                svg.style.pointerEvents = 'none';
                canvas.prepend(svg);
            }
            svg.appendChild(tempConnection);
        }
    });

    canvas.addEventListener('mousemove', (e) => {
        if (tempConnection && connectionStart) {
            const x = e.clientX - canvas.getBoundingClientRect().left;
            const y = e.clientY - canvas.getBoundingClientRect().top;
            tempConnection.setAttribute('x2', x);
            tempConnection.setAttribute('y2', y);
        }
    });

    canvas.addEventListener('mouseup', (e) => {
        if (tempConnection && connectionStart) {
            if (e.target.classList.contains('logic-port-in')) {
                const endNodeEl = e.target.closest('.logic-node');
                const endNodeId = endNodeEl.dataset.nodeId;
                
                if (endNodeId !== connectionStart.nodeId) {
                    logicConnections.push({
                        id: `conn_${Date.now()}`,
                        from: connectionStart.nodeId,
                        to: endNodeId
                    });
                }
            }
            
            tempConnection.remove();
            tempConnection = null;
            connectionStart = null;
            renderLogicCanvas();
        }
    });
}

function addLogicNode(type) {
    const node = {
        id: `node_${Date.now()}`,
        type: type,
        x: Math.random() * 500,
        y: Math.random() * 300,
        data: {}
    };

    switch(type) {
        case 'trigger':
            node.data = { event: 'onMessageSent' };
            break;
        case 'condition':
            node.data = { condition: 'message.text.includes("hello")' };
            break;
        case 'action':
            node.data = { action: 'sendMessage', params: {} };
            break;
        case 'variable':
            node.data = { name: 'myVar', value: '' };
            break;
        case 'ai':
            node.data = { prompt: 'Generate a response' };
            break;
        case 'loop':
            node.data = { type: 'for', iterations: 5 };
            break;
        case 'math':
            node.data = { operation: 'add', a: 0, b: 0 };
            break;
        case 'string':
            node.data = { operation: 'concat', strings: [] };
            break;
        case 'array':
            node.data = { operation: 'push', array: [], value: '' };
            break;
        case 'random':
            node.data = { min: 0, max: 100 };
            break;
        case 'delay':
            node.data = { seconds: 1 };
            break;
        case 'webhook':
            node.data = { url: '', method: 'POST', data: {} };
            break;
        case 'database':
            node.data = { operation: 'create', collection: '' };
            break;
        case 'filter':
            node.data = { condition: 'item > 0' };
            break;
        case 'map':
            node.data = { transform: 'item * 2' };
            break;
    }

    logicNodes.push(node);
    renderLogicCanvas();
}

function renderLogicCanvas() {
    const canvas = document.getElementById('logic-canvas');
    canvas.innerHTML = '';

    // Create SVG for connections
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.style.position = 'absolute';
    svg.style.top = '0';
    svg.style.left = '0';
    svg.style.width = '100%';
    svg.style.height = '100%';
    svg.style.pointerEvents = 'none';
    canvas.appendChild(svg);

    logicNodes.forEach(node => {
        const nodeEl = document.createElement('div');
        nodeEl.className = `logic-node logic-node-${node.type}`;
        nodeEl.style.left = node.x + 'px';
        nodeEl.style.top = node.y + 'px';
        nodeEl.dataset.nodeId = node.id;

        const icon = {
            trigger: '🎯',
            condition: '❓',
            action: '⚡',
            variable: '📊',
            ai: '🤖',
            loop: '🔁',
            math: '➗',
            string: '📝',
            array: '📋',
            random: '🎲',
            delay: '⏱️',
            webhook: '🌐',
            database: '💾',
            filter: '🔍',
            map: '🗺️'
        }[node.type] || '⚙️';

        nodeEl.innerHTML = `
            <div class="logic-node-header">
                <span class="logic-node-icon">${icon}</span>
                <span class="logic-node-title">${node.type}</span>
                <button class="logic-node-delete">×</button>
            </div>
            <div class="logic-node-body">
                ${renderNodeBody(node)}
            </div>
            <div class="logic-node-ports">
                <div class="logic-port logic-port-in"></div>
                <div class="logic-port logic-port-out"></div>
            </div>
        `;

        makeNodeDraggable(nodeEl, node);

        nodeEl.querySelector('.logic-node-delete').addEventListener('click', () => {
            deleteLogicNode(node.id);
        });

        // Save input changes
        nodeEl.querySelectorAll('.node-input').forEach(input => {
            input.addEventListener('change', (e) => {
                const field = e.target.dataset.field;
                if (field) {
                    node.data[field] = e.target.value;
                }
            });
        });

        canvas.appendChild(nodeEl);
    });

    // Render connections after nodes are in DOM
    requestAnimationFrame(() => {
        logicConnections.forEach(conn => {
            const fromNode = document.querySelector(`[data-node-id="${conn.from}"]`);
            const toNode = document.querySelector(`[data-node-id="${conn.to}"]`);
            
            if (fromNode && toNode) {
                const fromPort = fromNode.querySelector('.logic-port-out');
                const toPort = toNode.querySelector('.logic-port-in');
                
                const fromRect = fromPort.getBoundingClientRect();
                const toRect = toPort.getBoundingClientRect();
                const canvasRect = canvas.getBoundingClientRect();
                
                const x1 = fromRect.left + fromRect.width / 2 - canvasRect.left;
                const y1 = fromRect.top + fromRect.height / 2 - canvasRect.top;
                const x2 = toRect.left + toRect.width / 2 - canvasRect.left;
                const y2 = toRect.top + toRect.height / 2 - canvasRect.top;
                
                const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                line.setAttribute('x1', x1);
                line.setAttribute('y1', y1);
                line.setAttribute('x2', x2);
                line.setAttribute('y2', y2);
                line.setAttribute('stroke', '#00ffff');
                line.setAttribute('stroke-width', '2');
                line.style.pointerEvents = 'auto';
                line.style.cursor = 'pointer';
                line.dataset.connId = conn.id;
                
                line.addEventListener('click', () => {
                    if (confirm('Delete this connection?')) {
                        logicConnections = logicConnections.filter(c => c.id !== conn.id);
                        renderLogicCanvas();
                    }
                });
                
                svg.appendChild(line);
            }
        });
    });
}

function renderNodeBody(node) {
    switch(node.type) {
        case 'trigger':
            return `<select class="node-input" data-field="event">
                <option value="onMessageSent" ${node.data.event === 'onMessageSent' ? 'selected' : ''}>Message Sent</option>
                <option value="onUserJoin" ${node.data.event === 'onUserJoin' ? 'selected' : ''}>User Join</option>
                <option value="onUserLeave" ${node.data.event === 'onUserLeave' ? 'selected' : ''}>User Leave</option>
                <option value="onChannelChange" ${node.data.event === 'onChannelChange' ? 'selected' : ''}>Channel Change</option>
                <option value="onCommand" ${node.data.event === 'onCommand' ? 'selected' : ''}>Custom Command</option>
                <option value="onTimer" ${node.data.event === 'onTimer' ? 'selected' : ''}>Timer Tick</option>
            </select>`;
        case 'condition':
            return `<input type="text" class="node-input" data-field="condition" value="${node.data.condition || ''}" placeholder="Condition">`;
        case 'action':
            return `<select class="node-input" data-field="action">
                <option value="sendMessage" ${node.data.action === 'sendMessage' ? 'selected' : ''}>Send Message</option>
                <option value="muteUser" ${node.data.action === 'muteUser' ? 'selected' : ''}>Mute User</option>
                <option value="deleteMessage" ${node.data.action === 'deleteMessage' ? 'selected' : ''}>Delete Message</option>
                <option value="playSound" ${node.data.action === 'playSound' ? 'selected' : ''}>Play Sound</option>
                <option value="showNotification" ${node.data.action === 'showNotification' ? 'selected' : ''}>Show Notification</option>
                <option value="changeChannel" ${node.data.action === 'changeChannel' ? 'selected' : ''}>Change Channel</option>
                <option value="addReaction" ${node.data.action === 'addReaction' ? 'selected' : ''}>Add Reaction</option>
            </select>`;
        case 'variable':
            return `<input type="text" class="node-input" data-field="name" value="${node.data.name || ''}" placeholder="Variable name">
                    <input type="text" class="node-input" data-field="value" value="${node.data.value || ''}" placeholder="Value">`;
        case 'ai':
            return `<textarea class="node-input" data-field="prompt" placeholder="AI prompt">${node.data.prompt || ''}</textarea>`;
        case 'loop':
            return `<select class="node-input" data-field="type">
                <option value="for" ${node.data.type === 'for' ? 'selected' : ''}>For Loop</option>
                <option value="while" ${node.data.type === 'while' ? 'selected' : ''}>While Loop</option>
                <option value="forEach" ${node.data.type === 'forEach' ? 'selected' : ''}>For Each</option>
            </select>
            <input type="number" class="node-input" data-field="iterations" value="${node.data.iterations || 5}" placeholder="Iterations">`;
        case 'math':
            return `<select class="node-input" data-field="operation">
                <option value="add" ${node.data.operation === 'add' ? 'selected' : ''}>Add (+)</option>
                <option value="subtract" ${node.data.operation === 'subtract' ? 'selected' : ''}>Subtract (-)</option>
                <option value="multiply" ${node.data.operation === 'multiply' ? 'selected' : ''}>Multiply (×)</option>
                <option value="divide" ${node.data.operation === 'divide' ? 'selected' : ''}>Divide (÷)</option>
                <option value="modulo" ${node.data.operation === 'modulo' ? 'selected' : ''}>Modulo (%)</option>
            </select>
            <input type="number" class="node-input" data-field="a" value="${node.data.a || 0}" placeholder="A">
            <input type="number" class="node-input" data-field="b" value="${node.data.b || 0}" placeholder="B">`;
        case 'string':
            return `<select class="node-input" data-field="operation">
                <option value="concat" ${node.data.operation === 'concat' ? 'selected' : ''}>Concatenate</option>
                <option value="split" ${node.data.operation === 'split' ? 'selected' : ''}>Split</option>
                <option value="replace" ${node.data.operation === 'replace' ? 'selected' : ''}>Replace</option>
                <option value="uppercase" ${node.data.operation === 'uppercase' ? 'selected' : ''}>Uppercase</option>
                <option value="lowercase" ${node.data.operation === 'lowercase' ? 'selected' : ''}>Lowercase</option>
            </select>`;
        case 'array':
            return `<select class="node-input" data-field="operation">
                <option value="push" ${node.data.operation === 'push' ? 'selected' : ''}>Push</option>
                <option value="pop" ${node.data.operation === 'pop' ? 'selected' : ''}>Pop</option>
                <option value="shift" ${node.data.operation === 'shift' ? 'selected' : ''}>Shift</option>
                <option value="unshift" ${node.data.operation === 'unshift' ? 'selected' : ''}>Unshift</option>
                <option value="slice" ${node.data.operation === 'slice' ? 'selected' : ''}>Slice</option>
            </select>`;
        case 'random':
            return `<input type="number" class="node-input" data-field="min" value="${node.data.min || 0}" placeholder="Min">
                    <input type="number" class="node-input" data-field="max" value="${node.data.max || 100}" placeholder="Max">`;
        case 'delay':
            return `<input type="number" class="node-input" data-field="seconds" value="${node.data.seconds || 1}" placeholder="Seconds">`;
        case 'webhook':
            return `<input type="text" class="node-input" data-field="url" value="${node.data.url || ''}" placeholder="Webhook URL">
                    <select class="node-input" data-field="method">
                        <option value="GET" ${node.data.method === 'GET' ? 'selected' : ''}>GET</option>
                        <option value="POST" ${node.data.method === 'POST' ? 'selected' : ''}>POST</option>
                    </select>`;
        case 'database':
            return `<select class="node-input" data-field="operation">
                <option value="create" ${node.data.operation === 'create' ? 'selected' : ''}>Create</option>
                <option value="read" ${node.data.operation === 'read' ? 'selected' : ''}>Read</option>
                <option value="update" ${node.data.operation === 'update' ? 'selected' : ''}>Update</option>
                <option value="delete" ${node.data.operation === 'delete' ? 'selected' : ''}>Delete</option>
            </select>
            <input type="text" class="node-input" data-field="collection" value="${node.data.collection || ''}" placeholder="Collection">`;
        case 'filter':
            return `<textarea class="node-input" data-field="condition" placeholder="Filter condition">${node.data.condition || ''}</textarea>`;
        case 'map':
            return `<textarea class="node-input" data-field="transform" placeholder="Transform expression">${node.data.transform || ''}</textarea>`;
        default:
            return '';
    }
}

function makeNodeDraggable(nodeEl, node) {
    let isDragging = false;
    let startX, startY;

    const header = nodeEl.querySelector('.logic-node-header');

    header.addEventListener('mousedown', (e) => {
        if (e.target.classList.contains('logic-node-delete')) return;
        isDragging = true;
        startX = e.clientX - node.x;
        startY = e.clientY - node.y;
        e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        node.x = e.clientX - startX;
        node.y = e.clientY - startY;
        nodeEl.style.left = node.x + 'px';
        nodeEl.style.top = node.y + 'px';
        
        // Update connections
        updateNodeConnections(node.id);
    });

    document.addEventListener('mouseup', () => {
        isDragging = false;
    });
}

function updateNodeConnections(nodeId) {
    const canvas = document.getElementById('logic-canvas');
    const svg = canvas.querySelector('svg');
    if (!svg) return;

    logicConnections.forEach(conn => {
        if (conn.from === nodeId || conn.to === nodeId) {
            const line = svg.querySelector(`[data-conn-id="${conn.id}"]`);
            if (!line) return;

            const fromNode = document.querySelector(`[data-node-id="${conn.from}"]`);
            const toNode = document.querySelector(`[data-node-id="${conn.to}"]`);
            
            if (fromNode && toNode) {
                const fromPort = fromNode.querySelector('.logic-port-out');
                const toPort = toNode.querySelector('.logic-port-in');
                
                const fromRect = fromPort.getBoundingClientRect();
                const toRect = toPort.getBoundingClientRect();
                const canvasRect = canvas.getBoundingClientRect();
                
                const x1 = fromRect.left + fromRect.width / 2 - canvasRect.left;
                const y1 = fromRect.top + fromRect.height / 2 - canvasRect.top;
                const x2 = toRect.left + toRect.width / 2 - canvasRect.left;
                const y2 = toRect.top + toRect.height / 2 - canvasRect.top;
                
                line.setAttribute('x1', x1);
                line.setAttribute('y1', y1);
                line.setAttribute('x2', x2);
                line.setAttribute('y2', y2);
            }
        }
    });
}

function deleteLogicNode(nodeId) {
    logicNodes = logicNodes.filter(n => n.id !== nodeId);
    logicConnections = logicConnections.filter(c => c.from !== nodeId && c.to !== nodeId);
    renderLogicCanvas();
}

// Commands Editor
function addCommandEditor() {
    const command = {
        id: `cmd_${Date.now()}`,
        name: '/mycommand',
        description: '',
        action: ''
    };

    if (!currentEditingMod.commands) currentEditingMod.commands = [];
    currentEditingMod.commands.push(command);
    renderCommandsEditor(currentEditingMod.commands);
}

function renderCommandsEditor(commands) {
    const list = document.getElementById('commands-list');
    list.innerHTML = '';

    commands.forEach(cmd => {
        const cmdEl = document.createElement('div');
        cmdEl.className = 'command-editor-item';
        cmdEl.innerHTML = `
            <input type="text" class="admin-input" value="${cmd.name}" placeholder="/command">
            <textarea class="admin-textarea" placeholder="Description">${cmd.description}</textarea>
            <textarea class="admin-textarea code-textarea" placeholder="Action code">${cmd.action}</textarea>
            <button class="delete-command-btn">Delete</button>
        `;

        cmdEl.querySelector('.delete-command-btn').addEventListener('click', () => {
            currentEditingMod.commands = currentEditingMod.commands.filter(c => c.id !== cmd.id);
            renderCommandsEditor(currentEditingMod.commands);
        });

        list.appendChild(cmdEl);
    });
}

// UI Elements Editor
function addUIElementEditor() {
    const element = {
        id: `ui_${Date.now()}`,
        type: 'button',
        label: 'New Button',
        position: 'top',
        action: ''
    };

    if (!currentEditingMod.uiElements) currentEditingMod.uiElements = [];
    currentEditingMod.uiElements.push(element);
    renderUIElementsEditor(currentEditingMod.uiElements);
}

function renderUIElementsEditor(elements) {
    const list = document.getElementById('ui-elements-list');
    list.innerHTML = '';

    elements.forEach(el => {
        const elDiv = document.createElement('div');
        elDiv.className = 'ui-element-editor-item';
        elDiv.innerHTML = `
            <select class="admin-input">
                <option value="button" ${el.type === 'button' ? 'selected' : ''}>Button</option>
                <option value="input" ${el.type === 'input' ? 'selected' : ''}>Input</option>
                <option value="panel" ${el.type === 'panel' ? 'selected' : ''}>Panel</option>
            </select>
            <input type="text" class="admin-input" value="${el.label}" placeholder="Label">
            <select class="admin-input">
                <option value="top" ${el.position === 'top' ? 'selected' : ''}>Top</option>
                <option value="bottom" ${el.position === 'bottom' ? 'selected' : ''}>Bottom</option>
                <option value="left" ${el.position === 'left' ? 'selected' : ''}>Left</option>
                <option value="right" ${el.position === 'right' ? 'selected' : ''}>Right</option>
            </select>
            <textarea class="admin-textarea code-textarea" placeholder="Action code">${el.action}</textarea>
            <button class="delete-ui-element-btn">Delete</button>
        `;

        elDiv.querySelector('.delete-ui-element-btn').addEventListener('click', () => {
            currentEditingMod.uiElements = currentEditingMod.uiElements.filter(e => e.id !== el.id);
            renderUIElementsEditor(currentEditingMod.uiElements);
        });

        list.appendChild(elDiv);
    });
}

// Variables Tab
function renderVariablesTab() {
    const content = document.getElementById('editor-tab-variables');
    if (!content) return;
    
    const variablesHTML = Object.entries(modVariables).map(([key, value]) => `
        <div class="variable-item" style="background: rgba(0,0,0,0.2); padding: 1rem; border-radius: 5px; margin-bottom: 0.5rem; display: flex; gap: 1rem; align-items: center;">
            <input type="text" class="admin-input" value="${key}" placeholder="Variable name" style="flex: 1;" data-var-key="${key}">
            <input type="text" class="admin-input" value="${value}" placeholder="Value" style="flex: 2;" data-var-value="${key}">
            <button class="delete-var-btn" data-var="${key}" style="background: #dc3545; color: white; border: none; padding: 0.5rem 1rem; border-radius: 5px; cursor: pointer;">Delete</button>
        </div>
    `).join('');

    content.innerHTML = `
        <h3>Global Variables</h3>
        <p style="color: #888; margin-bottom: 1rem;">Define variables that persist across mod executions</p>
        <div id="variables-list">
            ${variablesHTML}
        </div>
        <button id="add-variable-btn" class="form-secondary-btn">+ Add Variable</button>
    `;

    content.querySelector('#add-variable-btn').addEventListener('click', () => {
        const key = `var${Object.keys(modVariables).length + 1}`;
        modVariables[key] = '';
        renderVariablesTab();
    });

    content.querySelectorAll('.delete-var-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            delete modVariables[btn.dataset.var];
            renderVariablesTab();
        });
    });

    content.querySelectorAll('[data-var-key]').forEach(input => {
        input.addEventListener('change', (e) => {
            const oldKey = e.target.dataset.varKey;
            const newKey = e.target.value;
            if (oldKey !== newKey) {
                modVariables[newKey] = modVariables[oldKey];
                delete modVariables[oldKey];
                renderVariablesTab();
            }
        });
    });

    content.querySelectorAll('[data-var-value]').forEach(input => {
        input.addEventListener('change', (e) => {
            modVariables[e.target.dataset.varValue] = e.target.value;
        });
    });
}

// Assets Tab
function renderAssetsTab() {
    const content = document.getElementById('editor-tab-assets');
    if (!content) return;

    const imagesHTML = modAssets.images.map((img, i) => `
        <div class="asset-item" style="background: rgba(0,0,0,0.2); padding: 1rem; border-radius: 5px; margin-bottom: 0.5rem;">
            <img src="${img.url}" style="max-width: 100px; max-height: 100px; border-radius: 5px; margin-bottom: 0.5rem;">
            <p style="color: var(--text-color); margin-bottom: 0.5rem;">${img.name}</p>
            <button class="delete-asset-btn" data-type="image" data-index="${i}" style="background: #dc3545; color: white; border: none; padding: 0.5rem 1rem; border-radius: 5px; cursor: pointer;">Delete</button>
        </div>
    `).join('');

    const soundsHTML = modAssets.sounds.map((sound, i) => `
        <div class="asset-item" style="background: rgba(0,0,0,0.2); padding: 1rem; border-radius: 5px; margin-bottom: 0.5rem;">
            <p style="color: var(--text-color); margin-bottom: 0.5rem;">🔊 ${sound.name}</p>
            <audio controls src="${sound.url}" style="width: 100%; margin-bottom: 0.5rem;"></audio>
            <button class="delete-asset-btn" data-type="sound" data-index="${i}" style="background: #dc3545; color: white; border: none; padding: 0.5rem 1rem; border-radius: 5px; cursor: pointer;">Delete</button>
        </div>
    `).join('');

    content.innerHTML = `
        <h3>Assets Manager</h3>
        <div style="margin-bottom: 2rem;">
            <h4 style="color: var(--primary-color); margin-bottom: 1rem;">Images</h4>
            <input type="file" id="upload-image" accept="image/*" style="display: none;">
            <button id="upload-image-btn" class="form-secondary-btn">+ Upload Image</button>
            <div id="images-loader" style="display: none; color: var(--primary-color); margin-top: 0.5rem;">Uploading...</div>
            <div id="images-list" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 1rem; margin-top: 1rem;">
                ${imagesHTML}
            </div>
        </div>
        <div>
            <h4 style="color: var(--primary-color); margin-bottom: 1rem;">Sounds</h4>
            <input type="file" id="upload-sound" accept="audio/*" style="display: none;">
            <button id="upload-sound-btn" class="form-secondary-btn">+ Upload Sound</button>
            <div id="sounds-loader" style="display: none; color: var(--primary-color); margin-top: 0.5rem;">Uploading...</div>
            <div id="sounds-list" style="display: flex; flex-direction: column; gap: 1rem; margin-top: 1rem;">
                ${soundsHTML}
            </div>
        </div>
    `;

    content.querySelector('#upload-image-btn').addEventListener('click', () => {
        content.querySelector('#upload-image').click();
    });

    content.querySelector('#upload-image').addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const loader = content.querySelector('#images-loader');
        loader.style.display = 'block';

        try {
            const url = await websim.upload(file);
            modAssets.images.push({ name: file.name, url });
            renderAssetsTab();
        } catch (error) {
            console.error('Upload failed:', error);
            alert('Upload failed');
        } finally {
            loader.style.display = 'none';
        }
    });

    content.querySelector('#upload-sound-btn').addEventListener('click', () => {
        content.querySelector('#upload-sound').click();
    });

    content.querySelector('#upload-sound').addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const loader = content.querySelector('#sounds-loader');
        loader.style.display = 'block';

        try {
            const url = await websim.upload(file);
            modAssets.sounds.push({ name: file.name, url });
            renderAssetsTab();
        } catch (error) {
            console.error('Upload failed:', error);
            alert('Upload failed');
        } finally {
            loader.style.display = 'none';
        }
    });

    content.querySelectorAll('.delete-asset-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const type = btn.dataset.type;
            const index = parseInt(btn.dataset.index);
            if (type === 'image') {
                modAssets.images.splice(index, 1);
            } else {
                modAssets.sounds.splice(index, 1);
            }
            renderAssetsTab();
        });
    });
}

// Templates Tab
function renderTemplatesTab() {
    const content = document.getElementById('editor-tab-templates');
    if (!content) return;

    const templates = [
        {
            name: 'Auto-Moderator',
            description: 'Automatically moderate chat messages',
            code: `// Auto-moderator template
const bannedWords = ['badword1', 'badword2'];

export function onMessageSent(message) {
    const lowerText = message.text.toLowerCase();
    const hasBannedWord = bannedWords.some(word => lowerText.includes(word));
    
    if (hasBannedWord) {
        deleteMessage(message.id);
        warnUser(message.author, 'Used banned words');
        return false; // Prevent message
    }
    return true;
}`
        },
        {
            name: 'Welcome Bot',
            description: 'Welcome new users with a custom message',
            code: `// Welcome bot template
export function onUserJoin(user) {
    const welcomeMessages = [
        \`Welcome \${user.name}! 👋\`,
        \`Hey \${user.name}, glad you're here!\`,
        \`\${user.name} just joined the party! 🎉\`
    ];
    
    const message = welcomeMessages[Math.floor(Math.random() * welcomeMessages.length)];
    sendMessage(message);
}`
        },
        {
            name: 'Command Handler',
            description: 'Handle custom commands',
            code: `// Command handler template
const commands = {
    '/help': () => 'Available commands: /help, /info, /stats',
    '/info': () => 'This is a custom mod!',
    '/stats': () => \`Users: \${participants.length}, Channels: \${Object.keys(channels).length}\`
};

export function onMessageSent(message) {
    if (message.text.startsWith('/')) {
        const command = message.text.split(' ')[0];
        if (commands[command]) {
            sendMessage(commands[command]());
            return false; // Prevent showing command
        }
    }
    return true;
}`
        },
        {
            name: 'AI Chat Bot',
            description: 'Respond to messages using AI',
            code: `// AI chat bot template
export async function onMessageSent(message) {
    if (message.text.includes('@bot')) {
        const prompt = message.text.replace('@bot', '').trim();
        
        const completion = await websim.chat.completions.create({
            messages: [
                { role: 'system', content: 'You are a helpful chat bot.' },
                { role: 'user', content: prompt }
            ]
        });
        
        sendMessage(\`@\${message.author} \${completion.content}\`);
    }
    return true;
}`
        },
        {
            name: 'Reaction Counter',
            description: 'Count and display message reactions',
            code: `// Reaction counter template
const reactions = {};

export function onMessageSent(message) {
    if (message.text.startsWith('!react ')) {
        const emoji = message.text.split(' ')[1];
        reactions[emoji] = (reactions[emoji] || 0) + 1;
        sendMessage(\`\${emoji}: \${reactions[emoji]} reactions!\`);
        return false;
    }
    return true;
}`
        },
        {
            name: 'Spam Filter',
            description: 'Prevent message spam',
            code: `// Spam filter template
const userMessages = new Map();
const SPAM_THRESHOLD = 5; // messages
const TIME_WINDOW = 5000; // 5 seconds

export function onMessageSent(message) {
    const now = Date.now();
    const userHistory = userMessages.get(message.author) || [];
    
    // Clean old messages
    const recentMessages = userHistory.filter(time => now - time < TIME_WINDOW);
    recentMessages.push(now);
    userMessages.set(message.author, recentMessages);
    
    if (recentMessages.length > SPAM_THRESHOLD) {
        muteUser(message.author, 30); // 30 seconds
        sendMessage(\`\${message.author} has been muted for spam\`);
        return false;
    }
    return true;
}`
        },
        {
            name: 'Role System',
            description: 'Custom role management',
            code: `// Role system template
const roles = {
    admin: ['ban', 'mute', 'delete'],
    moderator: ['mute', 'delete'],
    member: []
};

export function onMessageSent(message) {
    if (message.text.startsWith('/grant ')) {
        const [_, username, role] = message.text.split(' ');
        const user = participants.find(p => p.name === username);
        
        if (user && roles[role]) {
            user.customRole = role;
            sendMessage(\`Granted \${role} to \${username}\`);
        }
        return false;
    }
    return true;
}`
        }
    ];

    content.innerHTML = `
        <h3>Mod Templates</h3>
        <p style="color: #888; margin-bottom: 1rem;">Start with a pre-built template</p>
        <div style="display: grid; gap: 1rem;">
            ${templates.map(template => `
                <div class="template-card" style="background: rgba(0,0,0,0.3); border: 1px solid rgba(0,255,255,0.2); border-radius: 8px; padding: 1.5rem; cursor: pointer; transition: all 0.3s ease;">
                    <h4 style="color: var(--primary-color); margin-bottom: 0.5rem;">${template.name}</h4>
                    <p style="color: #ccc; margin-bottom: 1rem;">${template.description}</p>
                    <button class="use-template-btn" data-template-code="${encodeURIComponent(template.code)}" style="background: var(--primary-color); color: var(--background-color); border: none; padding: 0.5rem 1rem; border-radius: 5px; cursor: pointer;">Use Template</button>
                </div>
            `).join('')}
        </div>
    `;

    content.querySelectorAll('.use-template-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const code = decodeURIComponent(btn.dataset.templateCode);
            document.getElementById('mod-code-editor').value = code;
            switchEditorTab('code');
        });
    });
}

// Testing Console
function setupTestingConsole() {
    testConsoleOutput = [];
}

function renderTestingTab() {
    const content = document.getElementById('editor-tab-testing');
    if (!content) return;

    const outputHTML = testConsoleOutput.map(log => `
        <div style="padding: 0.5rem; border-bottom: 1px solid rgba(0,255,255,0.1); color: ${log.type === 'error' ? '#ff4d6d' : log.type === 'warn' ? '#ffc107' : '#0f0'};">
            <span style="color: #888;">[${log.timestamp}]</span> ${log.message}
        </div>
    `).join('');

    content.innerHTML = `
        <h3>Testing Console</h3>
        <div style="background: rgba(0,0,0,0.5); border: 1px solid var(--button-border); border-radius: 5px; padding: 1rem; margin-bottom: 1rem; max-height: 300px; overflow-y: auto; font-family: 'Courier New', monospace;">
            ${outputHTML || '<p style="color: #888;">No output yet...</p>'}
        </div>
        <div style="display: flex; gap: 1rem;">
            <button id="run-test-btn" class="form-secondary-btn">▶️ Run Test</button>
            <button id="clear-console-btn" class="form-secondary-btn">🗑️ Clear</button>
            <button id="test-msg-btn" class="form-secondary-btn">Test Message Event</button>
            <button id="test-join-btn" class="form-secondary-btn">Test User Join</button>
        </div>
        <div style="margin-top: 1.5rem;">
            <h4 style="color: var(--primary-color); margin-bottom: 0.5rem;">Variable Inspector</h4>
            <div id="variable-inspector" style="background: rgba(0,0,0,0.3); padding: 1rem; border-radius: 5px; font-family: 'Courier New', monospace;">
                ${Object.entries(modVariables).map(([key, value]) => `
                    <div><span style="color: var(--primary-color);">${key}:</span> <span style="color: #0f0;">${JSON.stringify(value)}</span></div>
                `).join('') || '<p style="color: #888;">No variables</p>'}
            </div>
        </div>
    `;

    content.querySelector('#run-test-btn').addEventListener('click', () => {
        runModTest();
    });

    content.querySelector('#clear-console-btn').addEventListener('click', () => {
        testConsoleOutput = [];
        renderTestingTab();
    });

    content.querySelector('#test-msg-btn').addEventListener('click', () => {
        testModEvent('onMessageSent', { author: 'TestUser', text: 'Hello world!' });
    });

    content.querySelector('#test-join-btn').addEventListener('click', () => {
        testModEvent('onUserJoin', { name: 'NewUser' });
    });
}

// New helper so the Test Mod button works without errors
function testCurrentMod() {
    // Ensure we are on the Testing tab and then run the test
    switchEditorTab('testing');
    runModTest();
}

function consoleLog(message, type = 'log') {
    testConsoleOutput.push({
        timestamp: new Date().toLocaleTimeString(),
        message,
        type
    });
}

function runModTest() {
    consoleLog('Starting mod test...', 'log');
    
    try {
        const code = document.getElementById('mod-code-editor').value;
        if (!code) {
            consoleLog('No code to test', 'warn');
            renderTestingTab();
            return;
        }

        // Create sandbox environment
        const sandbox = {
            participants,
            channels,
            player,
            websim: window.websim,
            console: {
                log: (msg) => consoleLog(msg, 'log'),
                warn: (msg) => consoleLog(msg, 'warn'),
                error: (msg) => consoleLog(msg, 'error')
            },
            sendMessage: (msg) => consoleLog(`[Send Message] ${msg}`, 'log'),
            muteUser: (user, time) => consoleLog(`[Mute User] ${user} for ${time}s`, 'log'),
            deleteMessage: (id) => consoleLog(`[Delete Message] ${id}`, 'log')
        };

        const func = new Function(...Object.keys(sandbox), code);
        func(...Object.values(sandbox));

        consoleLog('Test completed successfully ✓', 'log');
    } catch (error) {
        consoleLog(`Error: ${error.message}`, 'error');
    }

    renderTestingTab();
}

function testModEvent(eventName, data) {
    consoleLog(`Testing ${eventName} event...`, 'log');
    
    try {
        const eventCode = currentEditingMod.events[eventName];
        if (!eventCode) {
            consoleLog(`No code for ${eventName}`, 'warn');
            renderTestingTab();
            return;
        }

        const sandbox = {
            participants,
            channels,
            player,
            console: {
                log: (msg) => consoleLog(msg, 'log'),
                warn: (msg) => consoleLog(msg, 'warn'),
                error: (msg) => consoleLog(msg, 'error')
            },
            message: data,
            user: data
        };

        const func = new Function(...Object.keys(sandbox), eventCode);
        func(...Object.values(sandbox));

        consoleLog(`${eventName} test completed ✓`, 'log');
    } catch (error) {
        consoleLog(`Error: ${error.message}`, 'error');
    }

    renderTestingTab();
}

// Code Snippets Library
function renderSnippetsTab() {
    const content = document.getElementById('editor-tab-snippets');
    if (!content) return;

    const snippets = [
        {
            category: 'Messages',
            items: [
                { name: 'Send Message', code: 'sendMessage("Hello world!");' },
                { name: 'Reply to Message', code: 'sendMessage(`@${message.author} ${reply}`, message.id);' },
                { name: 'Delete Message', code: 'deleteMessage(message.id);' },
                { name: 'Edit Message', code: 'editMessage(message.id, "New text");' }
            ]
        },
        {
            category: 'User Actions',
            items: [
                { name: 'Mute User', code: 'muteUser(username, 60); // 60 seconds' },
                { name: 'Kick User', code: 'kickUser(username);' },
                { name: 'Ban User', code: 'banUser(username, "reason");' },
                { name: 'Get User Info', code: 'const user = participants.find(p => p.name === username);' }
            ]
        },
        {
            category: 'AI Integration',
            items: [
                { name: 'Simple AI Call', code: `const completion = await websim.chat.completions.create({
    messages: [{ role: 'user', content: 'Hello!' }]
});
const response = completion.content;` },
                { name: 'AI with System Prompt', code: `const completion = await websim.chat.completions.create({
    messages: [
        { role: 'system', content: 'You are helpful.' },
        { role: 'user', content: message.text }
    ]
});` },
                { name: 'Generate Image', code: `const result = await websim.imageGen({
    prompt: 'A beautiful sunset',
    aspect_ratio: '16:9'
});
const imageUrl = result.url;` }
            ]
        },
        {
            category: 'Database',
            items: [
                { name: 'Create Record', code: `const record = await room.collection('mydata').create({
    field: 'value'
});` },
                { name: 'Get All Records', code: 'const records = room.collection("mydata").getList();' },
                { name: 'Filter Records', code: 'const filtered = room.collection("mydata").filter({ status: "active" }).getList();' },
                { name: 'Subscribe to Changes', code: `room.collection('mydata').subscribe((records) => {
    console.log('Data updated:', records);
});` }
            ]
        },
        {
            category: 'Utilities',
            items: [
                { name: 'Random Number', code: 'const random = Math.floor(Math.random() * 100);' },
                { name: 'Delay/Wait', code: 'await new Promise(resolve => setTimeout(resolve, 1000)); // 1 second' },
                { name: 'Current Time', code: 'const timestamp = Date.now();' },
                { name: 'Format Date', code: 'const formatted = new Date().toLocaleString();' }
            ]
        }
    ];

    content.innerHTML = `
        <h3>Code Snippets</h3>
        <p style="color: #888; margin-bottom: 1rem;">Quick code snippets you can copy</p>
        ${snippets.map(category => `
            <div style="margin-bottom: 2rem;">
                <h4 style="color: var(--primary-color); margin-bottom: 1rem;">${category.category}</h4>
                <div style="display: grid; gap: 0.75rem;">
                    ${category.items.map(snippet => `
                        <div class="snippet-item" style="background: rgba(0,0,0,0.3); border: 1px solid rgba(0,255,255,0.1); border-radius: 5px; padding: 1rem;">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                                <strong style="color: var(--text-color);">${snippet.name}</strong>
                                <button class="copy-snippet-btn" data-code="${encodeURIComponent(snippet.code)}" style="background: rgba(0,255,255,0.2); border: 1px solid var(--primary-color); color: var(--primary-color); padding: 0.25rem 0.75rem; border-radius: 3px; cursor: pointer;">Copy</button>
                            </div>
                            <pre style="background: rgba(0,0,0,0.5); padding: 0.75rem; border-radius: 3px; overflow-x: auto; margin: 0;"><code style="color: #0f0; font-size: 0.85rem;">${snippet.code}</code></pre>
                        </div>
                    `).join('')}
                </div>
            </div>
        `).join('')}
    `;

    content.querySelectorAll('.copy-snippet-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const code = decodeURIComponent(btn.dataset.code);
            navigator.clipboard.writeText(code);
            btn.textContent = 'Copied!';
            setTimeout(() => {
                btn.textContent = 'Copy';
            }, 2000);
        });
    });
}

// Documentation Tab
function renderDocumentationTab() {
    const content = document.getElementById('editor-tab-documentation');
    if (!content) return;

    content.innerHTML = `
        <h3>Mod Development Guide</h3>
        
        <div style="display: flex; flex-direction: column; gap: 2rem; margin-top: 1rem;">
            <section>
                <h4 style="color: var(--primary-color); margin-bottom: 0.5rem;">📚 Event Hooks</h4>
                <p style="color: #ccc; margin-bottom: 0.5rem;">Your mod can respond to these events:</p>
                <ul style="color: var(--text-color); line-height: 1.8;">
                    <li><code style="color: #0f0;">onMessageSent(message)</code> - Fired when a message is sent</li>
                    <li><code style="color: #0f0;">onUserJoin(user)</code> - Fired when a user joins</li>
                    <li><code style="color: #0f0;">onUserLeave(user)</code> - Fired when a user leaves</li>
                    <li><code style="color: #0f0;">onChannelChange(channel)</code> - Fired when channel changes</li>
                </ul>
            </section>

            <section>
                <h4 style="color: var(--primary-color); margin-bottom: 0.5rem;">🔧 Available Functions</h4>
                <ul style="color: var(--text-color); line-height: 1.8;">
                    <li><code style="color: #0f0;">sendMessage(text, replyTo?)</code> - Send a message</li>
                    <li><code style="color: #0f0;">deleteMessage(id)</code> - Delete a message</li>
                    <li><code style="color: #0f0;">muteUser(username, seconds)</code> - Mute a user</li>
                    <li><code style="color: #0f0;">banUser(username, reason)</code> - Ban a user</li>
                    <li><code style="color: #0f0;">kickUser(username)</code> - Kick a user</li>
                    <li><code style="color: #0f0;">playSound(url)</code> - Play a sound effect</li>
                </ul>
            </section>

            <section>
                <h4 style="color: var(--primary-color); margin-bottom: 0.5rem;">📊 Available Data</h4>
                <ul style="color: var(--text-color); line-height: 1.8;">
                    <li><code style="color: #0f0;">participants</code> - Array of all users</li>
                    <li><code style="color: #0f0;">channels</code> - Object with all channels and messages</li>
                    <li><code style="color: #0f0;">player</code> - Current user object</li>
                    <li><code style="color: #0f0;">websim</code> - Access to AI and utilities</li>
                </ul>
            </section>

            <section>
                <h4 style="color: var(--primary-color); margin-bottom: 0.5rem;">🤖 AI Features</h4>
                <pre style="background: rgba(0,0,0,0.5); padding: 1rem; border-radius: 5px; overflow-x: auto;"><code style="color: #0f0;">// Chat completion
const response = await websim.chat.completions.create({
    messages: [
        { role: 'system', content: 'You are helpful' },
        { role: 'user', content: 'Hello!' }
    ],
    json: false // or true for JSON response
});

// Image generation
const img = await websim.imageGen({
    prompt: 'Description',
    aspect_ratio: '16:9'
});

// Text to speech
const audio = await websim.textToSpeech({
    text: 'Hello!',
    voice: 'en-male'
});</code></pre>
            </section>

            <section>
                <h4 style="color: var(--primary-color); margin-bottom: 0.5rem;">💾 Database Operations</h4>
                <pre style="background: rgba(0,0,0,0.5); padding: 1rem; border-radius: 5px; overflow-x: auto;"><code style="color: #0f0;">// Create
await room.collection('data').create({ field: 'value' });

// Read
const all = room.collection('data').getList();
const filtered = room.collection('data').filter({ status: 'active' }).getList();

// Update
await room.collection('data').update(id, { field: 'new value' });

// Delete
await room.collection('data').delete(id);

// Subscribe
room.collection('data').subscribe((records) => {
    console.log('Updated:', records);
});</code></pre>
            </section>

            <section>
                <h4 style="color: var(--primary-color); margin-bottom: 0.5rem;">⚡ Best Practices</h4>
                <ul style="color: var(--text-color); line-height: 1.8;">
                    <li>Use <code style="color: #0f0;">try/catch</code> blocks for error handling</li>
                    <li>Avoid blocking operations in event handlers</li>
                    <li>Store persistent data using database operations</li>
                    <li>Test your mod thoroughly before publishing</li>
                    <li>Document your mod's features and commands</li>
                </ul>
            </section>
        </div>
    `;
}

async function saveCurrentModData() {
    if (!currentEditingMod) return;

    // Gather all data
    currentEditingMod.name = document.getElementById('mod-name-input').value;
    currentEditingMod.description = document.getElementById('mod-description-input').value;
    currentEditingMod.author = document.getElementById('mod-author-input').value;
    currentEditingMod.version = document.getElementById('mod-version-input').value;

    currentEditingMod.logic = {
        nodes: logicNodes,
        connections: logicConnections
    };

    // Save commands
    const commandElements = document.querySelectorAll('.command-editor-item');
    currentEditingMod.commands = Array.from(commandElements).map((el, i) => {
        const inputs = el.querySelectorAll('input, textarea');
        return {
            id: currentEditingMod.commands?.[i]?.id || `cmd_${Date.now()}_${i}`,
            name: inputs[0].value,
            description: inputs[1].value,
            action: inputs[2].value
        };
    });

    // Save events
    const eventHandlers = document.querySelectorAll('.event-code');
    currentEditingMod.events = {
        onMessageSent: eventHandlers[0].value,
        onUserJoin: eventHandlers[1].value,
        onUserLeave: eventHandlers[2].value,
        onChannelChange: eventHandlers[3].value
    };

    // Save UI elements
    const uiElements = document.querySelectorAll('.ui-element-editor-item');
    currentEditingMod.uiElements = Array.from(uiElements).map((el, i) => {
        const inputs = el.querySelectorAll('select, input, textarea');
        return {
            id: currentEditingMod.uiElements?.[i]?.id || `ui_${Date.now()}_${i}`,
            type: inputs[0].value,
            label: inputs[1].value,
            position: inputs[2].value,
            action: inputs[3].value
        };
    });

    // Save code
    currentEditingMod.code = document.getElementById('mod-code-editor').value;

    // Save variables and assets
    currentEditingMod.variables = modVariables;
    currentEditingMod.assets = modAssets;
}

async function saveCurrentMod() {
    if (!currentEditingMod) return;

    await saveCurrentModData();

    // Ensure modId exists
    if (!currentEditingMod.modId) {
        currentEditingMod.modId = currentEditingMod.id;
    }

    try {
        const allMods = room.collection('mod').getList();
        const existing = allMods.find(m => m.modId === currentEditingMod.modId);
        
        const modData = {
            ...currentEditingMod,
            modId: currentEditingMod.modId,
            published: currentEditingMod.published || false,
            enabled: currentEditingMod.enabled || false
        };
        
        if (existing) {
            await room.collection('mod').update(existing.id, modData);
        } else {
            await room.collection('mod').create(modData);
        }

        alert('Mod saved successfully! 💾');
        hideModal(document.getElementById('mod-editor-modal'));
        await loadModsFromDatabase();
        renderInstalledMods();
    } catch (error) {
        console.error('Failed to save mod:', error);
        alert('Failed to save mod');
    }
}

// Export/Import functionality
async function saveCurrentModForPublish() {
    if (!currentEditingMod) return;

    // Gather all data
    currentEditingMod.name = document.getElementById('mod-name-input').value;
    currentEditingMod.description = document.getElementById('mod-description-input').value;
    currentEditingMod.author = document.getElementById('mod-author-input').value;
    currentEditingMod.version = document.getElementById('mod-version-input').value;

    currentEditingMod.logic.nodes = logicNodes;
    currentEditingMod.logic.connections = logicConnections;

    // Save commands
    const commandElements = document.querySelectorAll('.command-editor-item');
    currentEditingMod.commands = Array.from(commandElements).map((el, i) => {
        const inputs = el.querySelectorAll('input, textarea');
        return {
            id: currentEditingMod.commands[i]?.id || `cmd_${Date.now()}_${i}`,
            name: inputs[0].value,
            description: inputs[1].value,
            action: inputs[2].value
        };
    });

    // Save events
    const eventHandlers = document.querySelectorAll('.event-code');
    currentEditingMod.events.onMessageSent = eventHandlers[0].value;
    currentEditingMod.events.onUserJoin = eventHandlers[1].value;
    currentEditingMod.events.onUserLeave = eventHandlers[2].value;
    currentEditingMod.events.onChannelChange = eventHandlers[3].value;

    // Save UI elements
    const uiElements = document.querySelectorAll('.ui-element-editor-item');
    currentEditingMod.uiElements = Array.from(uiElements).map((el, i) => {
        const inputs = el.querySelectorAll('select, input, textarea');
        return {
            id: currentEditingMod.uiElements[i]?.id || `ui_${Date.now()}_${i}`,
            type: inputs[0].value,
            label: inputs[1].value,
            position: inputs[2].value,
            action: inputs[3].value
        };
    });

    // Save code
    currentEditingMod.code = document.getElementById('mod-code-editor').value;

    // Save variables
    currentEditingMod.variables = modVariables;

    // Save assets
    currentEditingMod.assets = modAssets;

    // Save to database
    try {
        const currentUser = await window.websim.getCurrentUser();
        const existing = room.collection('mod').getList().find(m => m.modId === currentEditingMod.id);
        if (existing) {
            await room.collection('mod').update(existing.id, { ...currentEditingMod, modId: currentEditingMod.id });
        } else {
            await room.collection('mod').create({ ...currentEditingMod, modId: currentEditingMod.id });
        }
    } catch (error) {
        console.error('Failed to save mod:', error);
        throw error;
    }
}

async function loadModsFromDatabase() {
    const currentUser = await window.websim.getCurrentUser();
    const allMods = room.collection('mod').getList();
    
    // Show published mods from everyone + user's own unpublished mods
    const mods = allMods.filter(m => 
        m.published === true || m.username === currentUser.username
    );
    
    renderModsBrowser(mods);
}

function renderModsBrowser(mods = []) {
    const grid = document.getElementById('mods-grid');
    grid.innerHTML = '';

    if (mods.length === 0) {
        grid.innerHTML = '<p style="text-align: center; padding: 2rem; color: #888;">No mods available yet. Create your first mod!</p>';
        return;
    }

    mods.forEach(mod => {
        const card = document.createElement('div');
        card.className = 'mod-card';
        card.innerHTML = `
            <h3>${mod.name}</h3>
            <p class="mod-author">by ${mod.author}</p>
            <p class="mod-description">${mod.description || 'No description'}</p>
            <div class="mod-meta">
                <span>v${mod.version}</span>
                <span>${mod.enabled ? '✅ Installed' : ''}</span>
            </div>
            <button class="mod-install-btn">${mod.enabled ? 'Disable' : 'Install'}</button>
        `;

        // Open details when clicking the card (not the button)
        card.addEventListener('click', (e) => {
            if (e.target.classList.contains('mod-install-btn')) return;
            showModDetails(mod);
        });

        // Install/Disable button
        const installBtn = card.querySelector('.mod-install-btn');
        installBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleModInstallation(mod);
        });

        grid.appendChild(card);
    });
}

async function showModDetails(mod) {
    const modal = document.getElementById('mod-detail-modal');
    document.getElementById('mod-detail-title').textContent = mod.name;

    const content = document.getElementById('mod-detail-content');
    
    const currentUser = await window.websim.getCurrentUser();
    const canEdit = mod.username === currentUser.username;
    
    content.innerHTML = `
        <p><strong>Author:</strong> ${mod.author}</p>
        <p><strong>Version:</strong> ${mod.version}</p>
        <p><strong>Status:</strong> ${mod.published ? '🌐 Published' : '🔒 Private'}</p>
        <p><strong>Description:</strong> ${mod.description || 'No description'}</p>
        <div style="margin-top: 1rem;">
            <strong>Features:</strong>
            <ul>
                ${mod.commands?.length ? `<li>${mod.commands.length} custom commands</li>` : ''}
                ${mod.logic?.nodes?.length ? `<li>${mod.logic.nodes.length} logic nodes</li>` : ''}
                ${mod.uiElements?.length ? `<li>${mod.uiElements.length} UI elements</li>` : ''}
                ${mod.code ? '<li>Custom code</li>' : ''}
            </ul>
        </div>
    `;

    const installBtn = document.getElementById('install-mod-btn');
    const editBtn = document.getElementById('edit-mod-btn');
    const deleteBtn = document.getElementById('delete-mod-btn');

    installBtn.textContent = mod.enabled ? 'Disable' : 'Install';
    installBtn.onclick = () => toggleModInstallation(mod);
    
    if (canEdit) {
        editBtn.style.display = 'inline-block';
        deleteBtn.style.display = 'inline-block';
        editBtn.onclick = () => {
            hideModal(modal);
            openModEditor(mod);
        };
        deleteBtn.onclick = () => deleteMod(mod);
    } else {
        editBtn.style.display = 'none';
        deleteBtn.style.display = 'none';
    }

    showModal(modal);
}

async function toggleModInstallation(mod) {
    try {
        // Get fresh data from database
        const allMods = room.collection('mod').getList();
        const dbMod = allMods.find(m => m.modId === mod.modId || m.id === mod.id);
        
        if (!dbMod) {
            alert('Mod not found in database');
            return;
        }

        const newEnabledState = !dbMod.enabled;

        // Update database
        await room.collection('mod').update(dbMod.id, { enabled: newEnabledState });

        // Update local state
        mod.enabled = newEnabledState;
        dbMod.enabled = newEnabledState;

        if (newEnabledState) {
            // Install mod
            if (!activeMods.find(m => (m.modId || m.id) === (dbMod.modId || dbMod.id))) {
                activeMods.push(dbMod);
            }
            executeModInit(dbMod);
            alert(`Mod "${mod.name}" installed! ✅`);
        } else {
            // Uninstall mod
            activeMods = activeMods.filter(m => (m.modId || m.id) !== (dbMod.modId || dbMod.id));
            executeModCleanup(dbMod);
            alert(`Mod "${mod.name}" disabled`);
        }

        // Refresh UI
        hideModal(document.getElementById('mod-detail-modal'));
        await loadModsFromDatabase();
        renderInstalledMods();
    } catch (error) {
        console.error('Failed to toggle mod:', error);
        alert('Failed to toggle mod installation');
    }
}

async function deleteMod(mod) {
    if (!confirm(`Delete "${mod.name}" permanently?`)) return;
    
    try {
        const allMods = room.collection('mod').getList();
        const dbMod = allMods.find(m => m.modId === mod.modId || m.id === mod.id);
        
        if (dbMod) {
            // Disable first if enabled
            if (dbMod.enabled) {
                executeModCleanup(dbMod);
                activeMods = activeMods.filter(m => (m.modId || m.id) !== (dbMod.modId || dbMod.id));
            }
            
            await room.collection('mod').delete(dbMod.id);
            alert('Mod deleted successfully');
            hideModal(document.getElementById('mod-detail-modal'));
            await loadModsFromDatabase();
            renderInstalledMods();
        }
    } catch (error) {
        console.error('Failed to delete mod:', error);
        alert('Failed to delete mod');
    }
}

function loadInstalledMods() {
    // Load all enabled mods from database
    const enabledMods = room.collection('mod').getList().filter(m => m.enabled === true);
    
    activeMods = enabledMods.slice();

    enabledMods.forEach(mod => {
        executeModInit(mod);
    });
    
    renderInstalledMods();
}

function renderInstalledMods() {
    const list = document.getElementById('installed-mods-list');
    if (!list) return;
    
    list.innerHTML = '';

    const enabledMods = room.collection('mod').getList().filter(m => m.enabled === true);

    if (enabledMods.length === 0) {
        list.innerHTML = '<li style="color: #888; padding: 1rem;">No mods installed</li>';
        return;
    }

    enabledMods.forEach(mod => {
        const li = document.createElement('li');
        li.className = 'installed-mod-item';
        li.innerHTML = `
            <span>${mod.name}</span>
            <button class="toggle-mod-btn" style="background: #dc3545; color: white; border: none; padding: 0.5rem 1rem; border-radius: 5px; cursor: pointer;">Disable</button>
        `;

        li.querySelector('.toggle-mod-btn').addEventListener('click', () => {
            toggleModInstallation(mod);
        });

        list.appendChild(li);
    });
}

// Mod Execution - Actually integrate with game
function executeModInit(mod) {
    try {
        // Clear any existing handlers for this mod first
        executeModCleanup(mod);
        
        // Execute custom code
        if (mod.code) {
            try {
                const sandbox = createModSandbox(mod);
                const modFunc = new Function(...Object.keys(sandbox), `
                    ${mod.code}
                    
                    if (typeof onMessageSent === 'function') {
                        window.__modMessageHandlers = window.__modMessageHandlers || [];
                        window.__modMessageHandlers.push({
                            modId: '${mod.modId || mod.id}',
                            handler: onMessageSent
                        });
                    }

                    if (typeof onInit === 'function') {
                        onInit();
                    }
                `);
                modFunc(...Object.values(sandbox));
            } catch (error) {
                console.error(`Mod "${mod.name}" code execution error:`, error);
            }
        }

        // Hook event handlers from Events tab
        if (mod.events?.onMessageSent) {
            window.__modMessageHandlers = window.__modMessageHandlers || [];
            window.__modMessageHandlers.push({
                modId: mod.modId || mod.id,
                handler: (message) => {
                    try {
                        const sandbox = createModSandbox(mod);
                        const func = new Function('message', ...Object.keys(sandbox), mod.events.onMessageSent);
                        return func(message, ...Object.values(sandbox));
                    } catch (error) {
                        console.error(`Mod "${mod.name}" onMessageSent error:`, error);
                        return true;
                    }
                }
            });
        }

        console.log(`✅ Mod "${mod.name}" initialized`);
    } catch (error) {
        console.error(`❌ Failed to initialize mod "${mod.name}":`, error);
    }
}

function createModSandbox(mod) {
    return {
        participants,
        channels,
        player,
        websim: window.websim,
        room,
        sendMessage: (text, replyTo = null) => {
            const activeChannelItem = document.querySelector('.chat-list .chat-item.active');
            if (activeChannelItem) {
                const channelId = activeChannelItem.dataset.channel;
                const messageData = createMessageDataObject(player.name, text, replyTo);
                addMessageToChannel(channelId, messageData);
            }
        },
        deleteMessage: (messageId) => {
            const activeChannelItem = document.querySelector('.chat-list .chat-item.active');
            if (activeChannelItem) {
                const channelId = activeChannelItem.dataset.channel;
                if (channels[channelId]) {
                    channels[channelId] = channels[channelId].filter(m => m.id !== messageId);
                    import('./message.js').then(({ renderMessagesForChannel }) => {
                        renderMessagesForChannel(channelId);
                    });
                }
            }
        },
        muteUser: (username, seconds) => {
            const user = participants.find(p => p.name === username);
            if (user) {
                user.isMuted = true;
                setTimeout(() => { user.isMuted = false; }, seconds * 1000);
            }
        },
        console: {
            log: (msg) => console.log(`[Mod: ${mod.name}]`, msg),
            warn: (msg) => console.warn(`[Mod: ${mod.name}]`, msg),
            error: (msg) => console.error(`[Mod: ${mod.name}]`, msg)
        }
    };
}

function executeModCleanup(mod) {
    if (window.__modMessageHandlers) {
        const modId = mod.modId || mod.id;
        window.__modMessageHandlers = window.__modMessageHandlers.filter(h => h.modId !== modId);
    }
    console.log(`🔇 Mod "${mod.name}" disabled`);
}

export { activeMods };