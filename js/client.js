/**
 * iChat Client Controller
 * Modern WebSocket Chat Experience
 */

document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const socketUrl = 'http://localhost:8000';
    let socket;

    try {
        socket = (typeof io !== 'undefined') ? io(socketUrl, { reconnectionAttempts: 5, timeout: 5000 }) : null;
    } catch (err) {
        console.warn('Socket.io connection initialization error:', err);
    }

    const form = document.getElementById('send-container');
    const messageInput = document.getElementById('messageInp');
    const messageContainer = document.getElementById('messagesContainer');
    const chatViewport = document.getElementById('chatViewport');
    const emptyState = document.getElementById('emptyState');
    const scrollBottomBtn = document.getElementById('scrollBottomBtn');
    
    // Header Status & Profile
    const statusIndicator = document.getElementById('statusIndicator');
    const connectionStatus = document.getElementById('connectionStatus');
    const roomSubtext = document.getElementById('roomSubtext');
    const currentUserNameEl = document.getElementById('currentUserName');
    const currentUserAvatarEl = document.getElementById('currentUserAvatar');
    const currentUserBadge = document.getElementById('currentUserBadge');
    
    // Controls
    const soundToggleBtn = document.getElementById('soundToggleBtn');
    const soundIconOn = document.getElementById('soundIconOn');
    const soundIconOff = document.getElementById('soundIconOff');
    const clearChatBtn = document.getElementById('clearChatBtn');

    // Emoji Controls
    const emojiToggleBtn = document.getElementById('emojiToggleBtn');
    const emojiPopover = document.getElementById('emojiPopover');
    const quickReactions = document.getElementById('quickReactions');

    // Modal
    const joinModal = document.getElementById('joinModal');
    const joinForm = document.getElementById('joinForm');
    const nameInput = document.getElementById('nameInput');
    const nameError = document.getElementById('nameError');
    const modalAvatarPreview = document.getElementById('modalAvatarPreview');

    // Audio Setup
    const audio = new Audio('tin.mp3');
    let isSoundEnabled = localStorage.getItem('ichat_sound_muted') !== 'true';

    // State
    let currentUsername = localStorage.getItem('ichat_username') || '';
    let isUserJoined = false;

    // Palette generator for participant avatars
    const avatarGradients = [
        'linear-gradient(135deg, #6366f1, #8b5cf6)',
        'linear-gradient(135deg, #ec4899, #f43f5e)',
        'linear-gradient(135deg, #06b6d4, #3b82f6)',
        'linear-gradient(135deg, #10b981, #059669)',
        'linear-gradient(135deg, #f59e0b, #d97706)',
        'linear-gradient(135deg, #8b5cf6, #d946ef)',
        'linear-gradient(135deg, #14b8a6, #06b6d4)'
    ];

    function getAvatarColor(name) {
        if (!name) return avatarGradients[0];
        let hash = 0;
        for (let i = 0; i < name.length; i++) {
            hash = name.charCodeAt(i) + ((hash << 5) - hash);
        }
        const index = Math.abs(hash) % avatarGradients.length;
        return avatarGradients[index];
    }

    function formatTime(date = new Date()) {
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    // Update connection status pills
    function setConnectionState(state, text) {
        if (!statusIndicator || !connectionStatus) return;
        
        statusIndicator.className = 'status-indicator ' + state;
        connectionStatus.className = 'live-pill ' + state;
        connectionStatus.textContent = text;

        if (state === 'connected') {
            roomSubtext.textContent = 'Connected to Node Server';
        } else if (state === 'disconnected') {
            roomSubtext.textContent = 'Disconnected — Retrying...';
        } else {
            roomSubtext.textContent = 'Connecting to localhost:8000';
        }
    }

    // Sound toggle handler
    function updateSoundUI() {
        if (isSoundEnabled) {
            soundIconOn.classList.remove('hidden');
            soundIconOff.classList.add('hidden');
            soundToggleBtn.setAttribute('title', 'Mute audio notification');
        } else {
            soundIconOn.classList.add('hidden');
            soundIconOff.classList.remove('hidden');
            soundToggleBtn.setAttribute('title', 'Unmute audio notification');
        }
    }

    if (soundToggleBtn) {
        updateSoundUI();
        soundToggleBtn.addEventListener('click', () => {
            isSoundEnabled = !isSoundEnabled;
            localStorage.setItem('ichat_sound_muted', (!isSoundEnabled).toString());
            updateSoundUI();
        });
    }

    // Play notification sound
    function playNotificationSound() {
        if (!isSoundEnabled) return;
        audio.currentTime = 0;
        audio.play().catch(e => {
            // Autoplay may be restricted until user interacts
            console.log('Audio autoplay prevented:', e.message);
        });
    }

    // Helper: Scroll container to bottom
    function scrollToBottom(smooth = true) {
        if (!messageContainer) return;
        messageContainer.scrollTo({
            top: messageContainer.scrollHeight,
            behavior: smooth ? 'smooth' : 'auto'
        });
    }

    // Scroll listener for "Scroll to bottom" button
    if (messageContainer && scrollBottomBtn) {
        messageContainer.addEventListener('scroll', () => {
            const distanceFromBottom = messageContainer.scrollHeight - messageContainer.scrollTop - messageContainer.clientHeight;
            if (distanceFromBottom > 160) {
                scrollBottomBtn.classList.remove('hidden');
            } else {
                scrollBottomBtn.classList.add('hidden');
            }
        });

        scrollBottomBtn.addEventListener('click', () => {
            scrollToBottom(true);
        });
    }

    // Update Modal Avatar Preview dynamically
    if (nameInput && modalAvatarPreview) {
        if (currentUsername) {
            nameInput.value = currentUsername;
            modalAvatarPreview.textContent = currentUsername.charAt(0).toUpperCase();
            modalAvatarPreview.style.background = getAvatarColor(currentUsername);
        }

        nameInput.addEventListener('input', () => {
            const val = nameInput.value.trim();
            nameError.classList.remove('visible');
            if (val) {
                modalAvatarPreview.textContent = val.charAt(0).toUpperCase();
                modalAvatarPreview.style.background = getAvatarColor(val);
            } else {
                modalAvatarPreview.textContent = '?';
                modalAvatarPreview.style.background = avatarGradients[0];
            }
        });
    }

    // Join Flow
    function completeJoin(name) {
        currentUsername = name;
        isUserJoined = true;
        localStorage.setItem('ichat_username', name);

        // Update Header Profile
        if (currentUserNameEl) currentUserNameEl.textContent = name;
        if (currentUserAvatarEl) {
            currentUserAvatarEl.textContent = name.charAt(0).toUpperCase();
            currentUserAvatarEl.style.background = getAvatarColor(name);
        }

        // Hide Modal
        if (joinModal) {
            joinModal.style.transition = 'opacity 0.25s ease';
            joinModal.style.opacity = '0';
            setTimeout(() => {
                joinModal.style.display = 'none';
                joinModal.style.opacity = '1';
                messageInput.focus();
            }, 250);
        }

        // Socket notify
        if (socket && socket.connected) {
            socket.emit('new-user-joined', name);
        }

        // Append self-welcome system message
        appendSystemMessage(`You joined the chat as ${name}`, 'joined');
    }

    if (joinForm) {
        joinForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const val = nameInput.value.trim();
            if (!val) {
                nameError.classList.add('visible');
                nameInput.focus();
                return;
            }
            completeJoin(val);
        });
    }

    // Allow user to re-open modal to change name
    if (currentUserBadge) {
        currentUserBadge.addEventListener('click', () => {
            if (joinModal) {
                joinModal.style.display = 'flex';
                nameInput.focus();
                nameInput.select();
            }
        });
    }

    // Append regular message (Left / Right)
    const append = (message, position, senderName = '') => {
        if (emptyState) {
            emptyState.style.display = 'none';
        }

        // Check if this is a system message formatted with 'joined' or 'left'
        if (typeof message === 'string') {
            if (message.endsWith('joined the chat')) {
                appendSystemMessage(message, 'joined');
                return;
            }
            if (message.endsWith('left the chat')) {
                appendSystemMessage(message, 'left');
                return;
            }
        }

        // Extract sender and text if formatted as "Name: Message"
        let displaySender = senderName;
        let displayText = message;

        if (!displaySender && typeof message === 'string' && message.includes(':')) {
            const colonIndex = message.indexOf(':');
            displaySender = message.substring(0, colonIndex).trim();
            displayText = message.substring(colonIndex + 1).trim();
        }

        if (position === 'right') {
            displaySender = 'You';
        } else if (!displaySender) {
            displaySender = 'Someone';
        }

        const messageWrapper = document.createElement('div');
        messageWrapper.classList.add('message-wrapper');

        const messageDiv = document.createElement('div');
        messageDiv.classList.add('message', position);

        // Avatar
        const avatarDiv = document.createElement('div');
        avatarDiv.classList.add('message-avatar');
        avatarDiv.textContent = displaySender.charAt(0).toUpperCase();
        avatarDiv.style.background = getAvatarColor(displaySender);

        // Bubble Content
        const bubbleDiv = document.createElement('div');
        bubbleDiv.classList.add('message-bubble');

        if (position === 'left') {
            const senderSpan = document.createElement('span');
            senderSpan.classList.add('message-sender');
            senderSpan.textContent = displaySender;
            bubbleDiv.appendChild(senderSpan);
        }

        const textSpan = document.createElement('div');
        textSpan.classList.add('message-text');
        textSpan.textContent = displayText;
        bubbleDiv.appendChild(textSpan);

        const metaDiv = document.createElement('div');
        metaDiv.classList.add('message-meta');
        metaDiv.textContent = formatTime();
        bubbleDiv.appendChild(metaDiv);

        messageDiv.appendChild(avatarDiv);
        messageDiv.appendChild(bubbleDiv);
        messageWrapper.appendChild(messageDiv);
        messageContainer.appendChild(messageWrapper);

        if (position === 'left') {
            playNotificationSound();
        }

        scrollToBottom(true);
    };

    // Append system status message (joined/left)
    function appendSystemMessage(text, type = 'joined') {
        if (emptyState) emptyState.style.display = 'none';

        const sysDiv = document.createElement('div');
        sysDiv.className = `system-event ${type}`;
        
        const iconSvg = type === 'joined' 
            ? `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>`
            : `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>`;

        sysDiv.innerHTML = `${iconSvg} <span>${text}</span>`;
        messageContainer.appendChild(sysDiv);
        scrollToBottom(true);
    }

    // Clear Chat
    if (clearChatBtn) {
        clearChatBtn.addEventListener('click', () => {
            if (!confirm('Clear message history from your view?')) return;
            messageContainer.innerHTML = '';
            if (emptyState) {
                emptyState.style.display = 'flex';
                messageContainer.appendChild(emptyState);
            }
        });
    }

    // Emoji Popover Toggle
    if (emojiToggleBtn && emojiPopover) {
        emojiToggleBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            emojiPopover.classList.toggle('hidden');
        });

        // Close popover when clicking outside
        document.addEventListener('click', (e) => {
            if (!emojiPopover.contains(e.target) && e.target !== emojiToggleBtn) {
                emojiPopover.classList.add('hidden');
            }
        });

        // Emoji grid selection
        emojiPopover.querySelectorAll('.emoji-item').forEach(btn => {
            btn.addEventListener('click', () => {
                const emoji = btn.textContent;
                messageInput.value += emoji;
                messageInput.focus();
            });
        });
    }

    // Quick Reaction Chips
    if (quickReactions) {
        quickReactions.querySelectorAll('.reaction-chip').forEach(chip => {
            chip.addEventListener('click', () => {
                const emoji = chip.getAttribute('data-emoji') || chip.textContent.trim();
                messageInput.value += ` ${emoji} `;
                messageInput.focus();
            });
        });
    }

    // Message Form Submit
    if (form) {
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            const message = messageInput.value.trim();
            if (!message) return;

            // If user hasn't chosen a name yet, prompt modal
            if (!isUserJoined) {
                if (joinModal) joinModal.style.display = 'flex';
                nameInput.focus();
                return;
            }

            append(message, 'right', 'You');

            if (socket && socket.connected) {
                socket.emit('send', message);
            } else {
                console.warn('Socket not connected. Message rendered locally only.');
            }

            messageInput.value = '';
            messageInput.focus();
            if (emojiPopover) emojiPopover.classList.add('hidden');
        });
    }

    // Socket Event Wiring
    if (socket) {
        socket.on('connect', () => {
            console.log('Connected to socket server:', socket.id);
            setConnectionState('connected', 'Live • Connected');

            // If user was already chosen previously, notify server
            if (isUserJoined && currentUsername) {
                socket.emit('new-user-joined', currentUsername);
            }
        });

        socket.on('disconnect', () => {
            console.log('Socket disconnected');
            setConnectionState('disconnected', 'Disconnected');
        });

        socket.on('connect_error', () => {
            setConnectionState('disconnected', 'Offline (Start Node Server)');
        });

        socket.on('user-joined', (name) => {
            if (name) {
                appendSystemMessage(`${name} joined the chat`, 'joined');
            }
        });

        socket.on('receive', (data) => {
            if (data && data.message) {
                append(data.message, 'left', data.name || 'Anonymous');
            }
        });

        socket.on('left', (name) => {
            if (name) {
                appendSystemMessage(`${name} left the chat`, 'left');
            }
        });
    } else {
        setConnectionState('disconnected', 'Offline (Start Node Server)');
    }

    // Auto-focus the join name input on startup
    if (nameInput && joinModal && joinModal.style.display !== 'none') {
        nameInput.focus();
    }
});