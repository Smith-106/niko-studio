document.addEventListener('DOMContentLoaded', () => {
    // === State ===
    let socket = null;
    const clientId = `client_${Date.now()}`;
    const state = {
        messages: [],
        draft: "",
        lockData: null,
        sceneCards: [],
        isConnected: false,
        reconnectDelay: 1000,
        reconnectMaxDelay: 30000,
        reconnectTimer: null
    };

    function escapeHtml(text) {
        const value = String(text ?? '');
        return value
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    // === DOM Elements ===
    const dom = {
        status: {
            connection: document.getElementById('connection-status'),
            agent: document.getElementById('agent-status')
        },
        chat: {
            stream: document.getElementById('chat-stream'),
            input: document.getElementById('user-input'),
            sendBtn: document.getElementById('send-btn')
        },
        tabs: document.querySelectorAll('.tab-btn'),
        panes: document.querySelectorAll('.tab-pane'),
        preview: {
            container: document.getElementById('draft-container')
        },
        lock: {
            total: document.getElementById('lock-total'),
            status: document.getElementById('lock-status'),
            chart: document.getElementById('lock-chart'),
            details: document.getElementById('lock-details')
        },
        radar: {
            chart: document.getElementById('quality-radar')
        },
        kanban: {
            cols: {
                pending: document.querySelector('#col-pending .card-list'),
                writing: document.querySelector('#col-writing .card-list'),
                done: document.querySelector('#col-done .card-list')
            }
        },
        graph: {
            container: document.getElementById('cy-container')
        },
        config: {
            workMode: document.getElementById('work-mode'),
            modelName: document.getElementById('model-name')
        }
    };

    // === WebSocket Connection ===
    function connect() {
        if (state.reconnectTimer) {
            clearTimeout(state.reconnectTimer);
            state.reconnectTimer = null;
        }

        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        socket = new WebSocket(`${protocol}//${window.location.host}/ws/${clientId}`);

        socket.onopen = () => {
            state.isConnected = true;
            state.reconnectDelay = 1000;
            updateConnectionStatus(true);
            addSystemMessage("系统连接成功。");
        };

        socket.onclose = () => {
            state.isConnected = false;
            updateConnectionStatus(false);
            addSystemMessage("系统断开连接，正在重试...");

            const jitter = Math.floor(Math.random() * 300);
            const delay = Math.min(state.reconnectDelay + jitter, state.reconnectMaxDelay);
            state.reconnectTimer = setTimeout(connect, delay);
            state.reconnectDelay = Math.min(state.reconnectDelay * 2, state.reconnectMaxDelay);
        };

        socket.onmessage = (event) => {
            let msg;
            try {
                msg = JSON.parse(event.data);
            } catch (error) {
                console.error('Invalid WebSocket message payload:', error, event.data);
                addSystemMessage('收到无效消息，已忽略。');
                return;
            }
            handleMessage(msg);
        };
    }

    function updateConnectionStatus(connected) {
        if (connected) {
            dom.status.connection.className = 'status-indicator connected';
            dom.status.connection.querySelector('.text').textContent = '已连接';
        } else {
            dom.status.connection.className = 'status-indicator disconnected';
            dom.status.connection.querySelector('.text').textContent = '未连接';
        }
    }

    // === Message Handling ===
    function handleMessage(msg) {
        console.log("Received:", msg);

        switch (msg.type) {
            case 'status':
                updateAgentStatus(msg.status, msg.message);
                break;
            case 'node_update':
                // Handle generic node updates if needed
                if (msg.node === 'architect') {
                    addAgentMessage('Architect', '已完成故事结构规划。');
                } else if (msg.node === 'writer') {
                    addAgentMessage('Writer', '草稿生成完毕。');
                } else if (msg.node === 'critic') {
                    addAgentMessage('Critic', '已完成质量评估。');
                }
                break;
            case 'draft_update':
                updateDraft(msg.content);
                break;
            case 'lock_update':
                updateLock(msg.data);
                break;
            case 'scenes_update':
                updateScenes(msg.data);
                break;
            case 'error':
                addSystemMessage(`错误: ${msg.message}`);
                break;
        }
    }

    function sendMessage() {
        const content = dom.chat.input.value.trim();
        if (!content || !state.isConnected) return;

        // Add user message to UI
        addUserMessage(content);

        // Send to server
        socket.send(JSON.stringify({
            type: 'start_workflow',
            content: content,
            mode: dom.config.workMode.value,
            model: dom.config.modelName.value
        }));

        dom.chat.input.value = '';
    }

    // === UI Updates ===

    function addSystemMessage(text) {
        const el = document.createElement('div');
        el.className = 'message system';
        const avatar = document.createElement('div');
        avatar.className = 'avatar';
        avatar.innerHTML = '<i class="fas fa-info-circle"></i>';
        const content = document.createElement('div');
        content.className = 'content';
        content.textContent = text;
        el.appendChild(avatar);
        el.appendChild(content);
        dom.chat.stream.appendChild(el);
        scrollToBottom();
    }

    function addUserMessage(text) {
        const el = document.createElement('div');
        el.className = 'message user';
        const avatar = document.createElement('div');
        avatar.className = 'avatar';
        avatar.innerHTML = '<i class="fas fa-user"></i>';
        const content = document.createElement('div');
        content.className = 'content';
        content.textContent = text;
        el.appendChild(avatar);
        el.appendChild(content);
        dom.chat.stream.appendChild(el);
        scrollToBottom();
    }

    function addAgentMessage(agentName, text) {
        const el = document.createElement('div');
        el.className = 'message assistant';
        const avatar = document.createElement('div');
        avatar.className = 'avatar';
        avatar.title = agentName;
        avatar.innerHTML = '<i class="fas fa-robot"></i>';
        const content = document.createElement('div');
        content.className = 'content';
        content.innerHTML = `<strong>${escapeHtml(agentName)}:</strong> ${escapeHtml(text)}`;
        el.appendChild(avatar);
        el.appendChild(content);
        dom.chat.stream.appendChild(el);
        scrollToBottom();
    }

    function updateAgentStatus(status, text) {
        dom.status.agent.innerHTML = `<div><i class="fas fa-spinner fa-spin"></i> ${escapeHtml(text)}</div>`;
        if (status === 'completed') {
            dom.status.agent.innerHTML = '<div><i class="fas fa-check"></i> 就绪</div>';
        }
    }

    function scrollToBottom() {
        dom.chat.stream.scrollTop = dom.chat.stream.scrollHeight;
    }

    function updateDraft(content) {
        state.draft = content;
        dom.preview.container.innerHTML = marked.parse(content);
    }

    function updateLock(data) {
        state.lockData = data;

        // Update Summary
        dom.lock.total.textContent = data.total_score;
        dom.lock.status.textContent = data.total_score >= 28 ? '✅ 达标' : '❌ 未达标';
        dom.lock.status.className = data.total_score >= 28 ? 'score-status success' : 'score-status warning';

        // Render Chart
        const trace = {
            x: ['Lead', 'Objective', 'Confrontation', 'Knockout'],
            y: [data.L_score, data.O_score, data.C_score, data.K_score],
            type: 'bar',
            marker: {
                color: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444']
            }
        };

        Plotly.newPlot(dom.lock.chart, [trace], {
            margin: { t: 20, b: 30, l: 30, r: 20 },
            height: 250,
            yaxis: { range: [0, 10] }
        }, { displayModeBar: false });

        // Update Radar (using same data for demo, ideally different)
        updateRadar([data.L_score * 10, data.O_score * 10, data.C_score * 10, data.K_score * 10, 80, 75, 70, 85]);
    }

    function updateRadar(scores) {
        const data = [{
            type: 'scatterpolar',
            r: scores,
            theta: ['Lead', 'Objective', 'Conflict', 'Ending', 'Pacing', 'Style', 'Logic', 'Emotion'],
            fill: 'toself'
        }];

        Plotly.newPlot(dom.radar.chart, data, {
            polar: {
                radialaxis: {
                    visible: true,
                    range: [0, 100]
                }
            },
            margin: { t: 20, b: 20, l: 40, r: 40 },
            height: 350
        }, { displayModeBar: false });
    }

    function updateScenes(scenes) {
        state.sceneCards = scenes;

        // Clear Lists
        dom.kanban.cols.pending.innerHTML = '';
        dom.kanban.cols.writing.innerHTML = '';
        dom.kanban.cols.done.innerHTML = '';

        // Populate
        scenes.forEach(scene => {
            const card = document.createElement('div');
            card.className = 'kanban-card';
            card.style.background = 'white';
            card.style.padding = '10px';
            card.style.marginBottom = '10px';
            card.style.borderRadius = '4px';
            card.style.border = '1px solid #e2e8f0';
            card.innerHTML = `<strong>${scene.scene_id}</strong><br>${scene.objective}`;

            // Simple logic for demo placement
            if (scene.scene_id === 'CH01-SC01') {
                dom.kanban.cols.writing.appendChild(card);
            } else {
                dom.kanban.cols.pending.appendChild(card);
            }
        });

        updateGraph(scenes);
    }

    function updateGraph(scenes) {
        const elements = [];
        scenes.forEach(scene => {
            elements.push({
                data: { id: scene.scene_id, label: scene.scene_id }
            });
            // Simple sequential edges for demo
            // In real app, use dependencies
        });

        // Add edges
        for (let i = 0; i < scenes.length - 1; i++) {
            elements.push({
                data: {
                    source: scenes[i].scene_id,
                    target: scenes[i+1].scene_id
                }
            });
        }

        const cy = cytoscape({
            container: dom.graph.container,
            elements: elements,
            style: [
                {
                    selector: 'node',
                    style: {
                        'background-color': '#3b82f6',
                        'label': 'data(label)',
                        'color': '#fff',
                        'text-valign': 'center',
                        'text-halign': 'center'
                    }
                },
                {
                    selector: 'edge',
                    style: {
                        'width': 2,
                        'line-color': '#ccc',
                        'target-arrow-color': '#ccc',
                        'target-arrow-shape': 'triangle',
                        'curve-style': 'bezier'
                    }
                }
            ],
            layout: {
                name: 'dagre'
            }
        });
    }

    // === Event Listeners ===
    dom.chat.sendBtn.addEventListener('click', sendMessage);
    dom.chat.input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

    dom.tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            // Remove active class
            dom.tabs.forEach(t => t.classList.remove('active'));
            dom.panes.forEach(p => p.classList.remove('active'));

            // Add active class
            tab.classList.add('active');
            const target = tab.dataset.tab;
            document.getElementById(target).classList.add('active');

            // Resize charts if needed
            if (target === 'radar') Plotly.relayout(dom.radar.chart, { autosize: true });
            if (target === 'lock') Plotly.relayout(dom.lock.chart, { autosize: true });
        });
    });

    // === Init ===
    connect();
    // Init empty charts
    Plotly.newPlot(dom.lock.chart, [], { margin: { t: 0 } });
    Plotly.newPlot(dom.radar.chart, [], { margin: { t: 0 } });
});
