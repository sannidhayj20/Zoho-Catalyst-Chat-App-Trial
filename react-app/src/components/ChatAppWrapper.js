import React, { useState, useEffect, useCallback } from 'react';
import { useMutation, useSubscription, gql } from '@apollo/client';

const GET_MESSAGES_SUB = gql`
  subscription OnMessageAdded($chatId: String!) {
    catalyst_message(
      where: { chat_id: { _eq: $chatId } }
      order_by: { created_time: asc }
    ) {
      id
      content
      is_bot
      created_time
    }
  }
`;

const SEND_MESSAGE = gql`
  mutation SendMessage($chatId: String!, $content: String!, $isBot: Boolean!) {
    insert_catalyst_message_one(
      object: {
        chat_id: $chatId
        content: $content
        is_bot: $isBot
      }
    ) {
      id
      content
      is_bot
      created_time
    }
  }
`;

const ChatAppWrapper = () => {
  const [chats, setChats] = useState([]);
  const [selectedChatId, setSelectedChatId] = useState(null);
  const [chatTitle, setChatTitle] = useState('');
  const [messageInput, setMessageInput] = useState('');
  const [loadingChats, setLoadingChats] = useState(false);
  const [isApiProcessing, setIsApiProcessing] = useState(false);
  const [botTyping, setBotTyping] = useState(false);

  const [sendMessage] = useMutation(SEND_MESSAGE);

  const { data: msgData, loading: msgsLoading, error: msgsError } = useSubscription(GET_MESSAGES_SUB, {
    variables: { chatId: selectedChatId },
    skip: !selectedChatId
  });

  // Debug logs
  useEffect(() => {
    if (msgsError) console.error('Subscription error:', msgsError);
    if (msgData) console.log('Messages from subscription:', msgData);
  }, [msgData, msgsError]);

  useEffect(() => {
    console.log('Selected Chat ID:', selectedChatId);
    console.log('Type of selectedChatId:', typeof selectedChatId);
  }, [selectedChatId]);

  const messages = msgData?.catalyst_message || [];

  // Fetch Chats via Catalyst
  const fetchChats = useCallback(async () => {
    setLoadingChats(true);
    try {
      const res = await fetch('/server/app_function/execute?mode=list_chats');
      const data = await res.json();
      const output = JSON.parse(data.output || '[]');
      setChats(Array.isArray(output) ? output : []);
    } catch (err) {
      console.error('Failed to load chats:', err);
      setChats([]);
    } finally {
      setLoadingChats(false);
    }
  }, []);

  const createChat = async () => {
    const title = chatTitle.trim();
    if (!title) return;
    try {
      const res = await fetch('/server/app_function/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'create_chat', title }),
      });
      const data = await res.json();
      const newChat = JSON.parse(data.output || '{}');
      if (newChat.ROWID) {
        setChatTitle('');
        fetchChats();
        setSelectedChatId(newChat.ROWID);
      }
    } catch (err) {
      console.error('Failed to create chat:', err);
    }
  };

  const deleteChat = async (chatId) => {
    if (!window.confirm('Delete this chat?')) return;
    try {
      await fetch('/server/app_function/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'delete_chat', chat_id: chatId }),
      });
      fetchChats();
      const remaining = chats.filter(c => c.ROWID !== chatId);
      setSelectedChatId(remaining.length > 0 ? remaining[0].ROWID : null);
    } catch (err) {
      console.error('Failed to delete chat:', err);
    }
  };

  // Save user message to database
  const saveUserMessage = async (content) => {
    try {
      await sendMessage({
        variables: {
          chatId: selectedChatId,
          content: content,
          isBot: false,
        },
      });
    } catch (err) {
      console.error('Error saving user message:', err);
      throw err;
    }
  };

  // Main send message function with API integration
  const handleSendMessage = async () => {
    if (!messageInput.trim() || !selectedChatId) return;

    const userContent = messageInput.trim();
    setMessageInput('');

    try {
      // 💬 Save user message to DB immediately — always
      await saveUserMessage(userContent);

      // 🚫 If API is busy, skip CrewAI call — but user msg is already saved
      if (isApiProcessing) {
        console.log('⚠️ API busy, skipping crewai call. User msg saved only.');
        return;
      }

      // 🔒 Lock API call and show typing animation
      setIsApiProcessing(true);
      setBotTyping(true);

      try {
        const response = await fetch("https://catalyst-crewai-integration.onrender.com/crew/message", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            topic: userContent,
            chat_id: selectedChatId,
          }),
        });

        const data = await response.json();
        console.log("🤖 API Response:", data);

        if (data.response) {
          await sendMessage({
            variables: {
              chatId: selectedChatId,
              content: data.response,
              isBot: true,
            },
          });
        } else {
          console.warn('No response from API');
        }
      } catch (err) {
        console.error("❌ Failed to call crewai bot:", err);
        // Send an error message to the chat
        await sendMessage({
          variables: {
            chatId: selectedChatId,
            content: "Sorry, I'm having trouble connecting right now. Please try again.",
            isBot: true,
          },
        });
      } finally {
        // ✅ Unlock API and hide typing animation
        setIsApiProcessing(false);
        setBotTyping(false);
      }
    } catch (err) {
      console.error('Error sending message:', err);
      setMessageInput(userContent); // rollback
    }
  };

  useEffect(() => {
    fetchChats();
  }, [fetchChats]);

  // Auto-scroll to bottom
  useEffect(() => {
    const container = document.querySelector('.ca-message-list');
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  }, [messages, botTyping]);

  // Typing animation component
  const TypingIndicator = () => (
    <div
      style={{
        textAlign: 'left',
        margin: '8px 0',
      }}
    >
      <div
        style={{
          display: 'inline-block',
          background: '#ff9800',
          color: 'white',
          padding: '8px 12px',
          borderRadius: '12px',
          maxWidth: '70%',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span>Bot is typing</span>
          <div style={{ display: 'flex', gap: '2px' }}>
            <div style={{ 
              width: '4px', 
              height: '4px', 
              backgroundColor: 'white', 
              borderRadius: '50%',
              animation: 'typing 1.4s infinite ease-in-out',
              animationDelay: '0s'
            }}></div>
            <div style={{ 
              width: '4px', 
              height: '4px', 
              backgroundColor: 'white', 
              borderRadius: '50%',
              animation: 'typing 1.4s infinite ease-in-out',
              animationDelay: '0.2s'
            }}></div>
            <div style={{ 
              width: '4px', 
              height: '4px', 
              backgroundColor: 'white', 
              borderRadius: '50%',
              animation: 'typing 1.4s infinite ease-in-out',
              animationDelay: '0.4s'
            }}></div>
          </div>
        </div>
      </div>
    </div>
  );

  // Render Chat List
  const renderChatList = () => {
    if (loadingChats) return <div>Loading chats...</div>;
    if (chats.length === 0) return <div>No chats. Create one!</div>;

    return chats.map(chat => (
      <div
        key={chat.ROWID}
        onClick={() => setSelectedChatId(chat.ROWID)}
        style={{
          padding: '10px',
          margin: '4px 0',
          background: selectedChatId === chat.ROWID ? '#333' : 'transparent',
          cursor: 'pointer',
          borderRadius: '8px'
        }}
      >
        {chat.title || `Chat ${chat.ROWID}`}
        <button
          onClick={(e) => {
            e.stopPropagation();
            deleteChat(chat.ROWID);
          }}
          style={{ float: 'right', background: 'none', border: 'none', color: 'red' }}
        >
          🗑️
        </button>
      </div>
    ));
  };

  // Render Messages
  const renderMessages = () => {
    if (!selectedChatId) return <div>Select a chat</div>;
    if (msgsLoading) return <div>Loading messages...</div>;
    
    const messageElements = messages.map(msg => (
      <div
        key={msg.id}
        style={{
          textAlign: msg.is_bot ? 'left' : 'right',
          margin: '8px 0',
        }}
      >
        <div
          style={{
            display: 'inline-block',
            background: msg.is_bot ? '#ff9800' : '#4cafef',
            color: 'white',
            padding: '8px 12px',
            borderRadius: '12px',
            maxWidth: '70%',
          }}
        >
          {msg.content}
        </div>
        <div style={{ fontSize: '0.7rem', color: '#aaa', marginTop: '2px' }}>
          {new Date(msg.created_time).toLocaleTimeString()}
        </div>
      </div>
    ));

    return (
      <div>
        {messageElements}
        {botTyping && <TypingIndicator />}
        {messages.length === 0 && !botTyping && <div>No messages yet</div>}
      </div>
    );
  };

  return (
    <div style={{ padding: '20px', background: '#121212', minHeight: '100vh', color: 'white' }}>
      <style>
        {`
          @keyframes typing {
            0%, 60%, 100% {
              transform: translateY(0);
              opacity: 0.3;
            }
            30% {
              transform: translateY(-10px);
              opacity: 1;
            }
          }
        `}
      </style>
      <div style={{ display: 'flex', gap: '20px', height: '80vh' }}>
        {/* Sidebar */}
        <div style={{ width: '300px', background: '#1e1e1e', padding: '16px', borderRadius: '8px' }}>
          <h3>Chats</h3>
          <input
            value={chatTitle}
            onChange={e => setChatTitle(e.target.value)}
            placeholder="New chat title"
            onKeyPress={e => e.key === 'Enter' && createChat()}
            style={{ 
              padding: '8px', 
              width: '100%', 
              marginBottom: '8px', 
              background: '#333', 
              color: 'white', 
              border: '1px solid #555',
              borderRadius: '4px'
            }}
          />
          <button
            onClick={createChat}
            disabled={!chatTitle.trim()}
            style={{ 
              padding: '8px', 
              width: '100%', 
              background: '#4cafef', 
              color: 'white', 
              border: 'none', 
              borderRadius: '4px',
              cursor: chatTitle.trim() ? 'pointer' : 'not-allowed',
              opacity: chatTitle.trim() ? 1 : 0.6
            }}
          >
            Create Chat
          </button>
          <div style={{ marginTop: '16px', maxHeight: '60vh', overflowY: 'auto' }}>
            {renderChatList()}
          </div>
        </div>

        {/* Messages */}
        <div style={{ 
          flex: 1, 
          display: 'flex', 
          flexDirection: 'column', 
          background: '#1e1e1e', 
          padding: '16px', 
          borderRadius: '8px' 
        }}>
          <div 
            className="ca-message-list"
            style={{ 
              flex: 1, 
              overflowY: 'auto', 
              padding: '8px', 
              background: '#2a2a2a', 
              borderRadius: '8px' 
            }}
          >
            {renderMessages()}
          </div>
          <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
            <input
              value={messageInput}
              onChange={e => setMessageInput(e.target.value)}
              onKeyPress={e => e.key === 'Enter' && handleSendMessage()}
              placeholder="Type a message..."
              disabled={!selectedChatId}
              style={{ 
                flex: 1, 
                padding: '8px', 
                background: '#333', 
                color: 'white', 
                border: '1px solid #555', 
                borderRadius: '4px' 
              }}
            />
            <button
              onClick={handleSendMessage}
              disabled={!messageInput.trim() || !selectedChatId || isApiProcessing}
              style={{ 
                padding: '8px 16px', 
                background: (!messageInput.trim() || !selectedChatId || isApiProcessing) ? '#4cafef' : '#4cafef', 
                color: 'white', 
                border: 'none', 
                borderRadius: '4px',
                cursor: (!messageInput.trim() || !selectedChatId || isApiProcessing) ? 'not-allowed' : 'pointer',
                opacity: (!messageInput.trim() || !selectedChatId || isApiProcessing) ? 1 : 1
              }}
            >
              Send
            </button>
          </div>
          {isApiProcessing && (
            <div style={{ 
              textAlign: 'center', 
              marginTop: '8px', 
              color: '#aaa', 
              fontSize: '0.9rem' 
            }}>
              🤖 Processing your message...
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ChatAppWrapper;