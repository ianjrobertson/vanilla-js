const socket = io("https://video.ianjrobertson.click");

let localStream;
let peerConnection;
let remoteSocketId;

const config = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
};

// Handle join form submission
document.getElementById('roomForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const room = document.getElementById('roomInput').value;

  await ensureLocalStream();
  socket.emit('join', room);
});

// Ensure local video/audio is available
async function ensureLocalStream() {
  if (!localStream) {
    localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    document.getElementById('localVideo').srcObject = localStream;
  }
}

// Create and configure the peer connection
function createPeerConnection() {
  peerConnection = new RTCPeerConnection(config);

  peerConnection.ontrack = ({ streams: [stream] }) => {
    document.getElementById('remoteVideo').srcObject = stream;
  };

  peerConnection.onicecandidate = (event) => {
    if (event.candidate && remoteSocketId) {
      socket.emit('ice-candidate', {
        target: remoteSocketId,
        candidate: event.candidate
      });
    }
  };
}

// Handle receiving info about an existing user
socket.on('other-user', async (socketId) => {
  remoteSocketId = socketId;

  await ensureLocalStream();
  createPeerConnection();

  localStream.getTracks().forEach(track => {
    peerConnection.addTrack(track, localStream);
  });

  const offer = await peerConnection.createOffer();
  await peerConnection.setLocalDescription(offer);

  socket.emit('offer', {
    target: socketId,
    sdp: offer
  });
});

// Handle being joined by a new user (optional: might be redundant)
socket.on('user-joined', (socketId) => {
  remoteSocketId = socketId;
  // Do nothing for now — the caller handles the offer.
});

// Handle receiving an offer
socket.on('offer', async (payload) => {
  remoteSocketId = payload.target;

  await ensureLocalStream();
  if (!peerConnection) createPeerConnection();

  await peerConnection.setRemoteDescription(new RTCSessionDescription(payload.sdp));

  localStream.getTracks().forEach(track => {
    peerConnection.addTrack(track, localStream);
  });

  const answer = await peerConnection.createAnswer();
  await peerConnection.setLocalDescription(answer);

  socket.emit('answer', {
    target: payload.target,
    sdp: answer
  });
});

// Handle receiving an answer
socket.on('answer', async (payload) => {
  if (!peerConnection) createPeerConnection(); // fallback safety
  await peerConnection.setRemoteDescription(new RTCSessionDescription(payload.sdp));
});

// Handle receiving ICE candidates
socket.on('ice-candidate', async (candidate) => {
  try {
    if (peerConnection) {
      await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
    }
  } catch (e) {
    console.error("Error adding received ice candidate", e);
  }
});
