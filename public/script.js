const socket = io("wss://video.ianjrobertson.click");
let localStream;
let peerConnection;
let remoteSocketId;

const config = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
};

document.getElementById('roomForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const room = document.getElementById('roomInput').value;
  socket.emit('join', room);

  localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
  document.getElementById('localVideo').srcObject = localStream;
});

socket.on('other-user', async (socketId) => {
  remoteSocketId = socketId;
  createPeerConnection();

  localStream.getTracks().forEach(track => {
    peerConnection.addTrack(track, localStream);
  });

  const offer = await peerConnection.createOffer();
  await peerConnection.setLocalDescription(offer);
  socket.emit('offer', { target: socketId, sdp: offer });
});

socket.on('user-joined', (socketId) => {
  remoteSocketId = socketId;
  createPeerConnection();
});

socket.on('offer', async (payload) => {
  peerConnection.setRemoteDescription(new RTCSessionDescription(payload.sdp));
  localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
  document.getElementById('localVideo').srcObject = localStream;

  localStream.getTracks().forEach(track => {
    peerConnection.addTrack(track, localStream);
  });

  const answer = await peerConnection.createAnswer();
  await peerConnection.setLocalDescription(answer);

  socket.emit('answer', { target: payload.target, sdp: answer });
});

socket.on('answer', async (payload) => {
  await peerConnection.setRemoteDescription(new RTCSessionDescription(payload.sdp));
});

socket.on('ice-candidate', async (candidate) => {
  try {
    await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
  } catch (e) {
    console.error("Error adding received ice candidate", e);
  }
});

function createPeerConnection() {
  peerConnection = new RTCPeerConnection(config);

  peerConnection.ontrack = ({ streams: [stream] }) => {
    document.getElementById('remoteVideo').srcObject = stream;
  };

  peerConnection.onicecandidate = (event) => {
    if (event.candidate) {
      socket.emit('ice-candidate', {
        target: remoteSocketId,
        candidate: event.candidate
      });
    }
  };
}
