class VideoChat {
            constructor() {
                this.socket = null;
                this.localStream = null;
                this.peerConnection = null;
                this.roomId = null;
                this.userId = null;
                
                // WebRTC configuration
                this.config = {
                    iceServers: [
                        { urls: 'stun:stun.l.google.com:19302' },
                        { urls: 'stun:stun1.l.google.com:19302' }
                    ]
                };
                
                this.initializeElements();
                this.setupEventListeners();
            }
            
            initializeElements() {
                this.roomInput = document.getElementById('roomInput');
                this.userInput = document.getElementById('userInput');
                this.joinBtn = document.getElementById('joinBtn');
                this.leaveBtn = document.getElementById('leaveBtn');
                this.toggleVideoBtn = document.getElementById('toggleVideo');
                this.toggleAudioBtn = document.getElementById('toggleAudio');
                this.status = document.getElementById('status');
                this.localVideo = document.getElementById('localVideo');
                this.remoteVideo = document.getElementById('remoteVideo');
                
                // Generate random user ID if not provided
                this.userInput.value = 'User' + Math.floor(Math.random() * 1000);
            }
            
            setupEventListeners() {
                this.joinBtn.addEventListener('click', () => this.joinRoom());
                this.leaveBtn.addEventListener('click', () => this.leaveRoom());
                this.toggleVideoBtn.addEventListener('click', () => this.toggleVideo());
                this.toggleAudioBtn.addEventListener('click', () => this.toggleAudio());
            }
            
            async joinRoom() {
                try {
                    this.roomId = this.roomInput.value.trim();
                    this.userId = this.userInput.value.trim();
                    
                    if (!this.roomId || !this.userId) {
                        this.updateStatus('Please enter room ID and username', 'error');
                        return;
                    }
                    
                    this.updateStatus('Connecting...', '');
                    
                    // Connect to signaling server
                    this.socket = io('https://video.ianjrobertson.click'); // Change to your server URL
                    
                    // Setup socket event listeners
                    this.setupSocketListeners();
                    
                    // Get user media
                    await this.getUserMedia();
                    
                    // Join room
                    this.socket.emit('join-room', this.roomId, this.userId);
                    
                    this.joinBtn.disabled = true;
                    this.leaveBtn.disabled = false;
                    
                } catch (error) {
                    console.error('Error joining room:', error);
                    this.updateStatus('Error joining room: ' + error.message, 'error');
                }
            }
            
            setupSocketListeners() {
                this.socket.on('connect', () => {
                    this.updateStatus(`Connected to room ${this.roomId}`, 'connected');
                });
                
                this.socket.on('user-joined', (userId) => {
                    console.log('User joined:', userId);
                    this.updateStatus(`${userId} joined the room`, 'connected');
                    // Start call as the initiator
                    this.startCall();
                });
                
                this.socket.on('existing-users', (users) => {
                    console.log('Existing users:', users);
                    if (users.length > 0) {
                        this.updateStatus(`Joined room with ${users.length} other user(s)`, 'connected');
                    }
                });
                
                this.socket.on('offer', async (data) => {
                    console.log('Received offer from:', data.from);
                    await this.handleOffer(data.offer, data.from);
                });
                
                this.socket.on('answer', async (data) => {
                    console.log('Received answer from:', data.from);
                    await this.handleAnswer(data.answer);
                });
                
                this.socket.on('ice-candidate', async (data) => {
                    console.log('Received ICE candidate from:', data.from);
                    await this.handleIceCandidate(data.candidate);
                });
                
                this.socket.on('user-left', (userId) => {
                    console.log('User left:', userId);
                    this.updateStatus(`${userId} left the room`, '');
                    this.remoteVideo.srcObject = null;
                });
                
                this.socket.on('disconnect', () => {
                    this.updateStatus('Disconnected from server', 'error');
                });
            }
            
            async getUserMedia() {
                try {
                    this.localStream = await navigator.mediaDevices.getUserMedia({
                        video: true,
                        audio: true
                    });
                    
                    this.localVideo.srcObject = this.localStream;
                    console.log('Got local stream');
                    
                } catch (error) {
                    console.error('Error getting user media:', error);
                    this.updateStatus('Error accessing camera/microphone: ' + error.message, 'error');
                    throw error;
                }
            }
            
            createPeerConnection() {
                this.peerConnection = new RTCPeerConnection(this.config);
                
                // Add local stream to peer connection
                this.localStream.getTracks().forEach(track => {
                    this.peerConnection.addTrack(track, this.localStream);
                });
                
                // Handle remote stream
                this.peerConnection.ontrack = (event) => {
                    console.log('Received remote stream');
                    this.remoteVideo.srcObject = event.streams[0];
                };
                
                // Handle ICE candidates
                this.peerConnection.onicecandidate = (event) => {
                    if (event.candidate) {
                        console.log('Sending ICE candidate');
                        this.socket.emit('ice-candidate', {
                            candidate: event.candidate,
                            from: this.userId
                        });
                    }
                };
                
                // Connection state changes
                this.peerConnection.onconnectionstatechange = () => {
                    console.log('Connection state:', this.peerConnection.connectionState);
                    if (this.peerConnection.connectionState === 'connected') {
                        this.updateStatus('Video call connected!', 'connected');
                    }
                };
            }
            
            async startCall() {
                console.log('Starting call...');
                this.createPeerConnection();
                
                try {
                    const offer = await this.peerConnection.createOffer();
                    await this.peerConnection.setLocalDescription(offer);
                    
                    this.socket.emit('offer', {
                        offer: offer,
                        from: this.userId
                    });
                    
                    console.log('Sent offer');
                } catch (error) {
                    console.error('Error creating offer:', error);
                }
            }
            
            async handleOffer(offer, from) {
                console.log('Handling offer...');
                this.createPeerConnection();
                
                try {
                    await this.peerConnection.setRemoteDescription(offer);
                    
                    const answer = await this.peerConnection.createAnswer();
                    await this.peerConnection.setLocalDescription(answer);
                    
                    this.socket.emit('answer', {
                        answer: answer,
                        from: this.userId,
                        to: from
                    });
                    
                    console.log('Sent answer');
                } catch (error) {
                    console.error('Error handling offer:', error);
                }
            }
            
            async handleAnswer(answer) {
                try {
                    await this.peerConnection.setRemoteDescription(answer);
                    console.log('Set remote description from answer');
                } catch (error) {
                    console.error('Error handling answer:', error);
                }
            }
            
            async handleIceCandidate(candidate) {
                try {
                    await this.peerConnection.addIceCandidate(candidate);
                    console.log('Added ICE candidate');
                } catch (error) {
                    console.error('Error adding ICE candidate:', error);
                }
            }
            
            leaveRoom() {
                if (this.socket) {
                    this.socket.disconnect();
                }
                
                if (this.peerConnection) {
                    this.peerConnection.close();
                    this.peerConnection = null;
                }
                
                if (this.localStream) {
                    this.localStream.getTracks().forEach(track => track.stop());
                    this.localStream = null;
                }
                
                this.localVideo.srcObject = null;
                this.remoteVideo.srcObject = null;
                
                this.joinBtn.disabled = false;
                this.leaveBtn.disabled = true;
                
                this.updateStatus('Left room', '');
            }
            
            toggleVideo() {
                if (this.localStream) {
                    const videoTrack = this.localStream.getVideoTracks()[0];
                    if (videoTrack) {
                        videoTrack.enabled = !videoTrack.enabled;
                        this.toggleVideoBtn.textContent = videoTrack.enabled ? 'Turn Off Video' : 'Turn On Video';
                    }
                }
            }
            
            toggleAudio() {
                if (this.localStream) {
                    const audioTrack = this.localStream.getAudioTracks()[0];
                    if (audioTrack) {
                        audioTrack.enabled = !audioTrack.enabled;
                        this.toggleAudioBtn.textContent = audioTrack.enabled ? 'Mute Audio' : 'Unmute Audio';
                    }
                }
            }
            
            updateStatus(message, type) {
                this.status.textContent = message;
                this.status.className = 'status ' + type;
            }
        }
        
        // Initialize the video chat when page loads
        document.addEventListener('DOMContentLoaded', () => {
            new VideoChat();
        });