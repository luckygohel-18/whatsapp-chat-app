// WhatsApp Web & Mobile Client Application
(function () {
  'use strict';

  // State
  let currentUser = localStorage.getItem('wa_username') || '';
  let currentDisplayName = localStorage.getItem('wa_display_name') || '';
  let activeContact = null;
  let socket = null;
  let typingTimeout = null;
  let isTyping = false;
  let contacts = [];
  let mediaRecorder = null;
  let audioChunks = [];
  let recordingInterval = null;
  let recordingSeconds = 0;
  let deferredInstallPrompt = null;
  let localServerUrl = window.location.origin;

  // DOM Elements
  const appContainer = document.getElementById('appContainer');
  const chatList = document.getElementById('chatList');
  const welcomeScreen = document.getElementById('welcomeScreen');
  const activeChatContainer = document.getElementById('activeChatContainer');
  const messagesContainer = document.getElementById('messagesContainer');
  const messageInput = document.getElementById('messageInput');
  const actionBtn = document.getElementById('actionBtn');
  const micIcon = document.getElementById('micIcon');
  const sendIcon = document.getElementById('sendIcon');
  const backToChatsBtn = document.getElementById('backToChatsBtn');
  const activeContactAvatar = document.getElementById('activeContactAvatar');
  const activeContactName = document.getElementById('activeContactName');
  const activeContactStatus = document.getElementById('activeContactStatus');
  const myAvatar = document.getElementById('myAvatar');
  const myDisplayName = document.getElementById('myDisplayName');
  const switchUserBtn = document.getElementById('switchUserBtn');
  const userProfileModal = document.getElementById('userProfileModal');
  const profileNameInput = document.getElementById('profileNameInput');
  const saveProfileBtn = document.getElementById('saveProfileBtn');
  const qrModal = document.getElementById('qrModal');
  const qrModalBtn = document.getElementById('qrModalBtn');
  const closeQrModalBtn = document.getElementById('closeQrModalBtn');
  const doneQrModalBtn = document.getElementById('doneQrModalBtn');
  const copyUrlBtn = document.getElementById('copyUrlBtn');
  const appNetworkUrl = document.getElementById('appNetworkUrl');
  const welcomeQrBtn = document.getElementById('welcomeQrBtn');
  const welcomeNewChatBtn = document.getElementById('welcomeNewChatBtn');
  const fabNewChat = document.getElementById('fabNewChat');
  const attachBtn = document.getElementById('attachBtn');
  const mediaFileInput = document.getElementById('mediaFileInput');
  const emojiBtn = document.getElementById('emojiBtn');
  const emojiPicker = document.getElementById('emojiPicker');
  const recordingOverlay = document.getElementById('recordingOverlay');
  const recordingTimer = document.getElementById('recordingTimer');
  const cancelRecordBtn = document.getElementById('cancelRecordBtn');
  const finishRecordBtn = document.getElementById('finishRecordBtn');
  const themeToggleBtn = document.getElementById('themeToggleBtn');
  const voiceCallBtn = document.getElementById('voiceCallBtn');
  const videoCallBtn = document.getElementById('videoCallBtn');
  const callModal = document.getElementById('callModal');
  const endCallBtn = document.getElementById('endCallBtn');
  const callContactAvatar = document.getElementById('callContactAvatar');
  const callContactName = document.getElementById('callContactName');
  const callStatusText = document.getElementById('callStatusText');
  const pwaInstallBanner = document.getElementById('pwaInstallBanner');
  const installPwaBtn = document.getElementById('installPwaBtn');
  const dismissPwaBtn = document.getElementById('dismissPwaBtn');
  const contactSearch = document.getElementById('contactSearch');

  // Colors for user avatars
  const avatarColors = ['#00a884', '#128c7e', '#34b7f1', '#e542a3', '#8e44ad', '#e67e22', '#27ae60', '#d35400'];

  function getAvatarColor(name) {
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return avatarColors[Math.abs(hash) % avatarColors.length];
  }

  // Init App
  function init() {
    registerServiceWorker();
    setupTheme();
    setupInstallBanner();
    fetchNetworkInfo();

    if (!currentUser) {
      promptUserProfile();
    } else {
      updateUserIdentityUI();
      connectWebSocket();
      loadContacts();
    }

    setupEventListeners();
  }

  // Register PWA Service Worker
  function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/static/sw.js')
        .then((reg) => console.log('ServiceWorker registered:', reg.scope))
        .catch((err) => console.warn('ServiceWorker registration failed:', err));
    }
  }

  // Theme setup
  function setupTheme() {
    const savedTheme = localStorage.getItem('wa_theme') || 'dark';
    document.body.setAttribute('data-theme', savedTheme);
  }

  function toggleTheme() {
    const current = document.body.getAttribute('data-theme') || 'dark';
    const next = current === 'dark' ? 'light' : 'dark';
    document.body.setAttribute('data-theme', next);
    localStorage.setItem('wa_theme', next);
  }

  // PWA Install prompt
  function setupInstallBanner() {
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      deferredInstallPrompt = e;
      pwaInstallBanner.classList.add('show');
    });

    installPwaBtn.addEventListener('click', async () => {
      if (deferredInstallPrompt) {
        deferredInstallPrompt.prompt();
        const { outcome } = await deferredInstallPrompt.userChoice;
        console.log('User response to install:', outcome);
        deferredInstallPrompt = null;
        pwaInstallBanner.classList.remove('show');
      }
    });

    dismissPwaBtn.addEventListener('click', () => {
      pwaInstallBanner.classList.remove('show');
    });
  }

  // Fetch local IP address for phone pairing
  async function fetchNetworkInfo() {
    try {
      const res = await fetch('/api/ip');
      const data = await res.json();
      if (data && data.url) {
        localServerUrl = data.url;
        appNetworkUrl.textContent = data.url;
      }
    } catch (e) {
      localServerUrl = window.location.origin;
      appNetworkUrl.textContent = window.location.origin;
    }
  }

  // User Profile
  function promptUserProfile() {
    profileNameInput.value = currentUser || '';
    userProfileModal.classList.add('active');
  }

  window.selectQuickUser = function (name) {
    profileNameInput.value = name;
  };

  saveProfileBtn.addEventListener('click', () => {
    const name = profileNameInput.value.trim();
    if (!name) return;
    currentUser = name.toLowerCase().replace(/\s+/g, '_');
    currentDisplayName = name;
    localStorage.setItem('wa_username', currentUser);
    localStorage.setItem('wa_display_name', currentDisplayName);
    userProfileModal.classList.remove('active');
    updateUserIdentityUI();
    connectWebSocket();
    loadContacts();
  });

  switchUserBtn.addEventListener('click', promptUserProfile);

  function updateUserIdentityUI() {
    myDisplayName.textContent = currentDisplayName || currentUser;
    myAvatar.textContent = (currentDisplayName || currentUser || 'U').charAt(0).toUpperCase();
    myAvatar.style.background = getAvatarColor(currentUser);
  }

  // WebSocket Connection
  function connectWebSocket() {
    if (socket) {
      try { socket.close(); } catch (e) {}
    }

    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${proto}//${window.location.host}/ws/${encodeURIComponent(currentUser)}`;
    socket = new WebSocket(wsUrl);

    socket.onopen = () => {
      console.log('Connected to WhatsApp WebSocket');
    };

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        handleSocketEvent(data);
      } catch (e) {
        console.error('Error handling socket message', e);
      }
    };

    socket.onclose = () => {
      console.log('WebSocket closed. Reconnecting in 3s...');
      setTimeout(connectWebSocket, 3000);
    };

    socket.onerror = (err) => {
      console.warn('WebSocket error:', err);
    };
  }

  // Handle Real-Time Events
  function handleSocketEvent(event) {
    switch (event.type) {
      case 'chat_message':
        onReceiveChatMessage(event);
        break;

      case 'message_ack':
        onMessageAck(event.message_id, event.status);
        break;

      case 'message_delivered':
        onMessageDelivered(event.message_id);
        break;

      case 'message_read':
        onMessageRead(event.message_id, event.reader);
        break;

      case 'typing':
        if (activeContact && activeContact.username === event.sender) {
          activeContactStatus.textContent = 'typing...';
          activeContactStatus.className = 'header-user-status status-typing';
        }
        updateContactTypingPreview(event.sender, true);
        break;

      case 'stop_typing':
        if (activeContact && activeContact.username === event.sender) {
          activeContactStatus.textContent = 'online';
          activeContactStatus.className = 'header-user-status status-online';
        }
        updateContactTypingPreview(event.sender, false);
        break;

      case 'user_status':
        updateUserPresence(event.username, event.online);
        break;
    }
  }

  // On receiving a message
  function onReceiveChatMessage(msg) {
    // If chat with sender is currently open
    if (activeContact && activeContact.username === msg.sender) {
      appendMessageBubble(msg, 'incoming');
      window.waSounds.playReceived();
      scrollToBottom();
      // Send read receipt
      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({
          type: 'read_receipt',
          message_id: msg.id,
          sender: msg.sender
        }));
      }
    } else {
      // Background / other chat
      window.waSounds.playReceived();
      if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
      incrementUnread(msg.sender, msg);
    }
    updateContactLastMessage(msg.sender, msg.content || (msg.message_type === 'image' ? '📷 Photo' : '🎤 Voice message'));
  }

  function onMessageAck(msgId, status) {
    const el = document.querySelector(`[data-msg-id="${msgId}"] .tick-icon`);
    if (el) {
      el.innerHTML = getTickSvg(status || 'sent');
    }
  }

  function onMessageDelivered(msgId) {
    const el = document.querySelector(`[data-msg-id="${msgId}"] .tick-icon`);
    if (el) {
      el.innerHTML = getTickSvg('delivered');
    }
  }

  function onMessageRead(msgId, reader) {
    const el = document.querySelector(`[data-msg-id="${msgId}"] .tick-icon`);
    if (el) {
      el.className = 'tick-icon blue-ticks';
      el.innerHTML = getTickSvg('read');
    }
  }

  // Tick Icons SVG
  function getTickSvg(status) {
    if (status === 'sent') {
      // Single grey tick
      return `<svg viewBox="0 0 16 15"><path d="M10.91 3.4L5.68 8.63 3.09 6.04l-.88.88 3.47 3.47 6.11-6.11-.88-.88z"/></svg>`;
    } else {
      // Double ticks (grey or blue)
      return `<svg viewBox="0 0 16 15"><path d="M15.01 3.31l-.88-.88-5.63 5.63-2.6-2.6-.88.88 3.48 3.48 6.51-6.51zm-4.32 0l-.88-.88-4.57 4.57.88.88 4.57-4.57zM5.8 8.44l-.88-.88-2.6 2.6-.88-.88-1.44 1.44 2.32 2.32 3.48-3.48-.88-.88.88-.88z"/></svg>`;
    }
  }

  // Load Contacts list
  async function loadContacts() {
    try {
      const res = await fetch('/api/users');
      const users = await res.json();
      
      // Filter out self
      contacts = users.filter(u => u.username !== currentUser);
      
      // Ensure at least a default "Friend" exists for immediate out-of-the-box chatting!
      const friendUsername = currentUser === 'friend' ? 'you' : 'friend';
      const friendDisplay = currentUser === 'friend' ? 'You' : 'Friend';
      if (!contacts.some(c => c.username === friendUsername)) {
        contacts.unshift({
          username: friendUsername,
          display_name: friendDisplay,
          online: true,
          last_seen: new Date().toISOString(),
          last_message: 'Hey! Tap here to start chatting.',
          unread_count: 0
        });
      }

      renderContactsList();
    } catch (e) {
      console.error('Failed to load contacts', e);
    }
  }

  function renderContactsList() {
    const filter = (contactSearch.value || '').toLowerCase();
    chatList.innerHTML = '';
    let totalUnread = 0;

    contacts.forEach(contact => {
      if (filter && !contact.display_name.toLowerCase().includes(filter)) return;
      totalUnread += (contact.unread_count || 0);

      const item = document.createElement('div');
      item.className = `chat-item ${activeContact && activeContact.username === contact.username ? 'active' : ''}`;
      item.dataset.username = contact.username;

      const initials = (contact.display_name || contact.username).charAt(0).toUpperCase();
      const color = getAvatarColor(contact.username);

      item.innerHTML = `
        <div class="avatar-container">
          <div class="avatar-circle" style="background: ${color}">${initials}</div>
          ${contact.online ? '<div class="online-dot"></div>' : ''}
        </div>
        <div class="chat-details">
          <div class="chat-row-top">
            <span class="contact-name">${contact.display_name || contact.username}</span>
            <span class="chat-time">${formatTime(contact.last_seen || new Date())}</span>
          </div>
          <div class="chat-row-bottom">
            <span class="last-message" id="lastMsg-${contact.username}">${contact.last_message || 'Tap to chat'}</span>
            ${contact.unread_count ? `<span class="unread-count">${contact.unread_count}</span>` : ''}
          </div>
        </div>
      `;

      item.addEventListener('click', () => openChat(contact));
      chatList.appendChild(item);
    });

    document.getElementById('totalUnreadBadge').textContent = totalUnread;
    document.getElementById('totalUnreadBadge').style.display = totalUnread > 0 ? 'inline-block' : 'none';
  }

  function updateContactLastMessage(username, text) {
    const msgEl = document.getElementById(`lastMsg-${username}`);
    if (msgEl) msgEl.textContent = text;
    const c = contacts.find(c => c.username === username);
    if (c) c.last_message = text;
  }

  function updateContactTypingPreview(username, isTyping) {
    const msgEl = document.getElementById(`lastMsg-${username}`);
    if (msgEl) {
      if (isTyping) {
        msgEl.textContent = 'typing...';
        msgEl.className = 'last-message typing-text';
      } else {
        const c = contacts.find(c => c.username === username);
        msgEl.textContent = c ? (c.last_message || '') : '';
        msgEl.className = 'last-message';
      }
    }
  }

  function incrementUnread(username, msg) {
    const c = contacts.find(c => c.username === username);
    if (c) {
      c.unread_count = (c.unread_count || 0) + 1;
      renderContactsList();
    }
  }

  function updateUserPresence(username, isOnline) {
    const c = contacts.find(u => u.username === username);
    if (c) {
      c.online = isOnline;
      renderContactsList();
      if (activeContact && activeContact.username === username) {
        activeContactStatus.textContent = isOnline ? 'online' : 'offline';
        activeContactStatus.className = isOnline ? 'header-user-status status-online' : 'header-user-status';
      }
    }
  }

  // Open Chat Screen
  async function openChat(contact) {
    activeContact = contact;
    contact.unread_count = 0;
    renderContactsList();

    // Show Chat Container, hide welcome screen
    welcomeScreen.style.display = 'none';
    activeChatContainer.style.display = 'flex';
    appContainer.classList.add('chat-active');

    // Header info
    activeContactName.textContent = contact.display_name || contact.username;
    activeContactAvatar.textContent = (contact.display_name || contact.username).charAt(0).toUpperCase();
    activeContactAvatar.style.background = getAvatarColor(contact.username);
    activeContactStatus.textContent = contact.online ? 'online' : 'last seen recently';
    activeContactStatus.className = contact.online ? 'header-user-status status-online' : 'header-user-status';

    // Clear previous messages and load history
    messagesContainer.querySelectorAll('.message-bubble').forEach(b => b.remove());
    await loadMessageHistory(contact.username);
  }

  async function loadMessageHistory(partner) {
    try {
      const res = await fetch(`/api/messages?user1=${encodeURIComponent(currentUser)}&user2=${encodeURIComponent(partner)}`);
      const msgs = await res.json();
      msgs.forEach(msg => {
        const type = msg.sender === currentUser ? 'outgoing' : 'incoming';
        appendMessageBubble(msg, type);
      });
      scrollToBottom();
    } catch (e) {
      console.error('Failed to load message history', e);
    }
  }

  function appendMessageBubble(msg, type) {
    const bubble = document.createElement('div');
    bubble.className = `message-bubble ${type}`;
    bubble.dataset.msgId = msg.id;

    let contentHtml = '';
    if (msg.message_type === 'image') {
      contentHtml = `
        <div class="media-image-wrapper">
          <img src="${msg.media_url}" alt="Photo" onclick="window.open('${msg.media_url}', '_blank')">
        </div>
      `;
    } else if (msg.message_type === 'audio') {
      contentHtml = `
        <div class="audio-voice-note">
          <button class="audio-play-btn" onclick="playVoiceNote(this, '${msg.media_url}')">
            <svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
          </button>
          <div class="audio-waveform-container">
            <div class="waveform-bar"><div class="waveform-progress"></div></div>
            <div class="audio-duration">Voice Note</div>
          </div>
        </div>
      `;
    }

    if (msg.content) {
      contentHtml += `<div class="message-bubble-content">${escapeHtml(msg.content)}</div>`;
    }

    const timeStr = formatTime(msg.timestamp || new Date());
    const tickHtml = type === 'outgoing' ? `
      <span class="tick-icon ${msg.status === 'read' ? 'blue-ticks' : ''}">
        ${getTickSvg(msg.status || 'sent')}
      </span>
    ` : '';

    bubble.innerHTML = `
      ${contentHtml}
      <div class="message-meta">
        <span>${timeStr}</span>
        ${tickHtml}
      </div>
    `;

    messagesContainer.appendChild(bubble);
  }

  // Voice Note Playback
  window.playVoiceNote = function (btn, url) {
    let audio = btn.audioObj;
    if (!audio) {
      audio = new Audio(url);
      btn.audioObj = audio;
      audio.onended = () => {
        btn.innerHTML = `<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>`;
      };
      audio.ontimeupdate = () => {
        const bar = btn.parentElement.querySelector('.waveform-progress');
        if (bar && audio.duration) {
          bar.style.width = `${(audio.currentTime / audio.duration) * 100}%`;
        }
      };
    }

    if (audio.paused) {
      audio.play();
      btn.innerHTML = `<svg viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>`;
    } else {
      audio.pause();
      btn.innerHTML = `<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>`;
    }
  };

  // Send Message
  function sendMessage() {
    const text = messageInput.value.trim();
    if (!text || !activeContact) return;

    const tempId = 'msg_' + Date.now();
    const msgObj = {
      id: tempId,
      sender: currentUser,
      recipient: activeContact.username,
      content: text,
      message_type: 'text',
      timestamp: new Date().toISOString(),
      status: 'sent'
    };

    appendMessageBubble(msgObj, 'outgoing');
    scrollToBottom();
    window.waSounds.playSent();

    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({
        type: 'chat_message',
        id: tempId,
        recipient: activeContact.username,
        content: text,
        message_type: 'text'
      }));
    }

    updateContactLastMessage(activeContact.username, text);
    messageInput.value = '';
    updateActionBtnState();
    messageInput.focus();
  }

  // Typing indicator trigger
  function handleTypingInput() {
    updateActionBtnState();
    if (!activeContact || !socket || socket.readyState !== WebSocket.OPEN) return;

    if (!isTyping) {
      isTyping = true;
      socket.send(JSON.stringify({
        type: 'typing',
        recipient: activeContact.username
      }));
    }

    clearTimeout(typingTimeout);
    typingTimeout = setTimeout(() => {
      isTyping = false;
      if (socket && socket.readyState === WebSocket.OPEN && activeContact) {
        socket.send(JSON.stringify({
          type: 'stop_typing',
          recipient: activeContact.username
        }));
      }
    }, 1800);
  }

  function updateActionBtnState() {
    const hasText = messageInput.value.trim().length > 0;
    if (hasText) {
      micIcon.style.display = 'none';
      sendIcon.style.display = 'block';
      actionBtn.title = 'Send Message';
    } else {
      micIcon.style.display = 'block';
      sendIcon.style.display = 'none';
      actionBtn.title = 'Record Voice Message';
    }
  }

  // Attach Image Upload
  attachBtn.addEventListener('click', () => mediaFileInput.click());

  mediaFileInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file || !activeContact) return;

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/upload', { method: 'POST', body: formData });
      const data = await res.json();
      if (data && data.url) {
        const tempId = 'img_' + Date.now();
        const msgObj = {
          id: tempId,
          sender: currentUser,
          recipient: activeContact.username,
          content: '',
          message_type: 'image',
          media_url: data.url,
          timestamp: new Date().toISOString(),
          status: 'sent'
        };

        appendMessageBubble(msgObj, 'outgoing');
        scrollToBottom();
        window.waSounds.playSent();

        if (socket && socket.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify({
            type: 'chat_message',
            id: tempId,
            recipient: activeContact.username,
            content: '',
            message_type: 'image',
            media_url: data.url
          }));
        }
        updateContactLastMessage(activeContact.username, '📷 Photo');
      }
    } catch (err) {
      alert('Failed to upload image');
    }
    mediaFileInput.value = '';
  });

  // Voice Note Recording
  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorder = new MediaRecorder(stream);
      audioChunks = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunks.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        clearInterval(recordingInterval);
        recordingOverlay.classList.remove('active');
        stream.getTracks().forEach(t => t.stop());

        if (mediaRecorder.canceled) {
          mediaRecorder.canceled = false;
          return;
        }

        const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
        if (audioBlob.size < 500) return; // Too short

        const formData = new FormData();
        formData.append('file', audioBlob, 'voicenote.webm');

        try {
          const res = await fetch('/api/upload', { method: 'POST', body: formData });
          const data = await res.json();
          if (data && data.url && activeContact) {
            const tempId = 'audio_' + Date.now();
            const msgObj = {
              id: tempId,
              sender: currentUser,
              recipient: activeContact.username,
              content: '',
              message_type: 'audio',
              media_url: data.url,
              timestamp: new Date().toISOString(),
              status: 'sent'
            };

            appendMessageBubble(msgObj, 'outgoing');
            scrollToBottom();
            window.waSounds.playSent();

            if (socket && socket.readyState === WebSocket.OPEN) {
              socket.send(JSON.stringify({
                type: 'chat_message',
                id: tempId,
                recipient: activeContact.username,
                content: '',
                message_type: 'audio',
                media_url: data.url
              }));
            }
            updateContactLastMessage(activeContact.username, '🎤 Voice note');
          }
        } catch (e) {
          console.error('Error sending audio note', e);
        }
      };

      mediaRecorder.start();
      window.waSounds.playRecordStart();
      recordingSeconds = 0;
      recordingTimer.textContent = '00:00';
      recordingOverlay.classList.add('active');

      recordingInterval = setInterval(() => {
        recordingSeconds++;
        const mins = String(Math.floor(recordingSeconds / 60)).padStart(2, '0');
        const secs = String(recordingSeconds % 60).padStart(2, '0');
        recordingTimer.textContent = `${mins}:${secs}`;
      }, 1000);

    } catch (err) {
      alert('Microphone access is required to send voice notes.');
    }
  }

  function stopRecording(canceled = false) {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.canceled = canceled;
      mediaRecorder.stop();
      window.waSounds.playRecordStop();
    }
  }

  cancelRecordBtn.addEventListener('click', () => stopRecording(true));
  finishRecordBtn.addEventListener('click', () => stopRecording(false));

  // Action Button (Send or Mic)
  actionBtn.addEventListener('click', () => {
    if (messageInput.value.trim().length > 0) {
      sendMessage();
    } else {
      startRecording();
    }
  });

  // Emoji Picker
  emojiBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    emojiPicker.classList.toggle('active');
  });

  document.querySelectorAll('.emoji-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      messageInput.value += btn.textContent;
      emojiPicker.classList.remove('active');
      messageInput.focus();
      handleTypingInput();
    });
  });

  document.addEventListener('click', (e) => {
    if (!emojiPicker.contains(e.target) && e.target !== emojiBtn) {
      emojiPicker.classList.remove('active');
    }
  });

  // Call Simulation
  function startCall(type) {
    if (!activeContact) return;
    callContactName.textContent = activeContact.display_name || activeContact.username;
    callContactAvatar.textContent = (activeContact.display_name || activeContact.username).charAt(0).toUpperCase();
    callContactAvatar.style.background = getAvatarColor(activeContact.username);
    callStatusText.textContent = `WhatsApp ${type} calling...`;
    callModal.classList.add('active');
    window.waSounds.startRinging();
  }

  voiceCallBtn.addEventListener('click', () => startCall('Voice'));
  videoCallBtn.addEventListener('click', () => startCall('Video'));
  endCallBtn.addEventListener('click', () => {
    window.waSounds.stopRinging();
    callModal.classList.remove('active');
  });

  // Event Listeners
  function setupEventListeners() {
    messageInput.addEventListener('input', handleTypingInput);
    messageInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });

    backToChatsBtn.addEventListener('click', () => {
      appContainer.classList.remove('chat-active');
    });

    themeToggleBtn.addEventListener('click', toggleTheme);

    // QR Modal
    qrModalBtn.addEventListener('click', () => qrModal.classList.add('active'));
    welcomeQrBtn.addEventListener('click', () => qrModal.classList.add('active'));
    closeQrModalBtn.addEventListener('click', () => qrModal.classList.remove('active'));
    doneQrModalBtn.addEventListener('click', () => qrModal.classList.remove('active'));

    copyUrlBtn.addEventListener('click', () => {
      navigator.clipboard.writeText(localServerUrl);
      copyUrlBtn.textContent = 'Copied!';
      setTimeout(() => copyUrlBtn.textContent = 'Copy Link', 2000);
    });

    welcomeNewChatBtn.addEventListener('click', () => {
      if (contacts.length > 0) openChat(contacts[0]);
    });

    fabNewChat.addEventListener('click', () => {
      const name = prompt('Enter contact name or phone number:');
      if (name) {
        const user = {
          username: name.toLowerCase().replace(/\s+/g, '_'),
          display_name: name,
          online: false,
          last_seen: new Date().toISOString(),
          last_message: 'Tap to chat',
          unread_count: 0
        };
        contacts.unshift(user);
        renderContactsList();
        openChat(user);
      }
    });

    contactSearch.addEventListener('input', renderContactsList);
  }

  function scrollToBottom() {
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }

  function formatTime(iso) {
    try {
      const d = new Date(iso);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch (e) {
      return '';
    }
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // Start
  init();

})();
