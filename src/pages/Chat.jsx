import { useState, useEffect, useRef } from 'react';
import 'bootstrap/dist/css/bootstrap.min.css';
import io from 'socket.io-client';
import { Button, Badge } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';

const Chat = () => {
  // State management for messages, users, and current chat
  
  const user = JSON.parse(localStorage.getItem("user")); // Get user from localStorage
  const userNameLocal = user?.name; // Get name from user object
  const userIdLocal = user?._id; // Get _id from user object
  const [userName, setUserName] = useState(userNameLocal);
  const [userId, setUserId] = useState(userIdLocal);
  const [messages, setMessages] = useState([]);
  
  const navigate = useNavigate();
  const [onlineUsers, setOnlineUsers] = useState([]); // Will now store full user objects
  const [selectedUser, setSelectedUser] = useState(null); // Changed to null initially
  const [newMessage, setNewMessage] = useState('');
  const [currentUser, setCurrentUser] = useState(user); // Use the user from localStorage
  const [unreadCounts, setUnreadCounts] = useState({});
  const messagesEndRef = useRef(null); // For auto-scrolling
  const socketRef = useRef(null); // For persistent socket reference
  
  // Auto-scroll to bottom of messages
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (!currentUser?._id || !currentUser?.name) {
      console.log('No user data available:', currentUser);
      navigate('/login');
      return;
    }

    // Initialize socket connection
    socketRef.current = io('http://localhost:3000', {
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000
    });

    // Handle socket connection errors
    socketRef.current.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
    });

    socketRef.current.on('connect', () => {
      console.log('Socket connected successfully');
      // Connect to socket with both id and name
      socketRef.current.emit('user_connected', {
        userId: currentUser._id,
        userName: currentUser.name
      });
    });

    // Load unread counts
    fetchUnreadCounts();

    // Socket listeners
    socketRef.current.on('users_online', (users) => {
      console.log('Received online users:', users);
      // Filter out current user and store full user objects
      setOnlineUsers(users.filter(user => user.userId !== currentUser._id));
    });

    socketRef.current.on('new_message', ({ message, sender }) => {
      console.log('Received new message:', message, 'from:', sender);
      if (selectedUser && sender === selectedUser.userId) {
        setMessages(prev => [...prev, message]);
        socketRef.current.emit('mark_as_read', message._id);
      } else {
        // Update unread count for sender
        setUnreadCounts(prev => ({
          ...prev,
          [sender]: (prev[sender] || 0) + 1
        }));
      }
    });

    socketRef.current.on('message_read', (messageId) => {
      console.log('Message marked as read:', messageId);
      setMessages(prev => 
        prev.map(msg => 
          msg._id === messageId ? { ...msg, isRead: true } : msg
        )
      );
    });

    return () => {
      if (socketRef.current) {
        socketRef.current.off('connect_error');
        socketRef.current.off('connect');
        socketRef.current.off('users_online');
        socketRef.current.off('new_message');
        socketRef.current.off('message_read');
        socketRef.current.disconnect();
      }
    };
  }, [currentUser]);

  // Separate useEffect for selectedUser changes
  useEffect(() => {
    if (selectedUser) {
      loadChatHistory(selectedUser.userId);
    }
  }, [selectedUser]);

  const fetchUnreadCounts = async () => {
    try {
      if (!currentUser?._id) return;
      
      const response = await fetch(`http://localhost:3000/api/unread-count/${currentUser._id}`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const counts = await response.json();
      const countsMap = counts.reduce((acc, { _id, count }) => {
        acc[_id] = count;
        return acc;
      }, {});
      setUnreadCounts(countsMap);
    } catch (error) {
      console.error('Error fetching unread counts:', error);
    }
  };

  const loadChatHistory = async (userId) => {
    try {
      if (!currentUser?._id || !userId) return;

      const response = await fetch(`http://localhost:3000/api/messages/${currentUser._id}/${userId}`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      console.log('Loaded chat history:', data);
      setMessages(data);
      
      // Mark messages as read
      const unreadMessages = data.filter(msg => 
        !msg.isRead && msg.sender === userId
      );
      
      unreadMessages.forEach(msg => {
        socketRef.current.emit('mark_as_read', msg._id);
      });

      // Clear unread count for selected user
      setUnreadCounts(prev => ({
        ...prev,
        [userId]: 0
      }));
    } catch (error) {
      console.error('Error loading chat history:', error);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (newMessage.trim() && selectedUser) {
      const messageData = {
        senderId: currentUser._id,
        receiverId: selectedUser.userId, // Changed from _id to userId
        content: newMessage
      };
      
      console.log('Sending message:', messageData);
      socketRef.current.emit('private_message', messageData);
      
      // Optimistically add message to UI
      const optimisticMessage = {
        _id: Date.now().toString(), // Temporary ID
        sender: currentUser._id,
        receiver: selectedUser.userId,
        content: newMessage,
        isRead: false,
        createdAt: new Date()
      };
      
      setMessages(prev => [...prev, optimisticMessage]);
      setNewMessage('');
    }
  };

  const handleLogout = () => {
    if (socketRef.current) {
      socketRef.current.disconnect();
    }
    localStorage.clear();
    navigate('/login');
  };

  return (
    <div className="container py-5">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h4>Welcome, {currentUser?.name}</h4>
        <Button onClick={handleLogout}>Logout</Button>
      </div>
      <div className="row">
        {/* Online Users Sidebar */}
        <div className="col-md-4">
          <div className="card">
            <div className="card-header bg-primary text-white">
              <h5 className="mb-0">Online Users ({onlineUsers.length})</h5>
            </div>
            <div className="card-body">
              <div className="list-group">
                {onlineUsers.length === 0 ? (
                  <div className="text-muted text-center p-3">
                    No users online
                  </div>
                ) : (
                  onlineUsers.map(user => (
                    <button
                      key={user.userId}
                      className={`list-group-item list-group-item-action d-flex justify-content-between align-items-center ${
                        selectedUser?.userId === user.userId ? 'active' : ''
                      }`}
                      onClick={() => setSelectedUser(user)}
                    >
                      {user.userName}
                      {unreadCounts[user.userId] > 0 && (
                        <Badge bg="danger" pill>
                          {unreadCounts[user.userId]}
                        </Badge>
                      )}
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Chat Area */}
        <div className="col-md-8">
          <div className="card">
            <div className="card-header bg-primary text-white">
              <h5 className="mb-0">
                {selectedUser ? `Chat with ${selectedUser.userName}` : 'Select a user to start chatting'}
              </h5>
            </div>
            <div className="card-body" style={{ height: '400px', overflowY: 'auto' }}>
              <div className="messages">
                {messages.map((message, index) => (
                  <div 
                    key={message._id || index} 
                    className={`message mb-3 ${message.sender === currentUser._id ? 'text-end' : ''}`}
                  >
                    <div className={`message-content p-2 rounded d-inline-block ${
                      message.sender === currentUser._id ? 'bg-primary text-white' : 'bg-light'
                    }`}>
                      {message.content}
                      <small className="d-block text-end">
                        {message.sender === currentUser._id && (
                          <span className={message.sender === currentUser._id ? 'text-white-50' : ''}>
                            {message.isRead ? '✓✓' : '✓'}
                          </span>
                        )}
                        <span className="ms-2">
                          {new Date(message.createdAt).toLocaleTimeString()}
                        </span>
                      </small>
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
            </div>
            <div className="card-footer">
              <form onSubmit={handleSubmit}>
                <div className="input-group">
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Type your message..."
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    disabled={!selectedUser}
                  />
                  <button 
                    type="submit" 
                    className="btn btn-primary"
                    disabled={!selectedUser || !newMessage.trim()}
                  >
                    Send
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Chat;
