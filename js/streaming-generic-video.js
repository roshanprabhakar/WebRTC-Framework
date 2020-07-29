
// const monitors = ['bytesReceived', 'packetsReceived', 'headerBytesReceived', 'packetsLost', 'totalDecodeTime', 'totalInterFrameDelay', 'codecId'];
const monitors = ['bytesReceived'];
let startTime;

//local video component
let localVideo = document.querySelector("#gum-local");
let localStream;

//streamed video component
let streamedVideo = document.querySelector("#gum-streamed");

let pc1;
let pc2;



function getOtherPc(pc) {
    if (pc === pc1) {
        return pc2;
    } else return pc1;
}

async function onIceCandidate(pc, event) {
    try {
        await (getOtherPc(pc)).addIceCandidate(event.candidate);
    } catch (ignored) {
    }
}

async function initiateVideoFeed() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({video: true, audio: false});
        localStream = stream;
        localVideo.srcObject = stream;
    } catch (e) {
        alert(`getUserMedia() error: ${e.name}`);
    }
}

function initiatePeerConnections() {
    const SDPSemantics = {};

    pc1 = new RTCPeerConnection(SDPSemantics);
    pc1.addEventListener('icecandidate', e => onIceCandidate(pc1, e));

    pc2 = new RTCPeerConnection(SDPSemantics);
    pc2.addEventListener('icecandidate', e => onIceCandidate(pc2, e));

    let statsInterval = window.setInterval(getConnectionStats, 1000);

    pc2.addEventListener('track', gotRemoteStream);

    localStream.getVideoTracks().forEach(track => pc1.addTrack(track, localStream));
}

async function connectPeerConnections() {
    try {
        let offer = await pc1.createOffer({offerToReceiveVideo: 1, offerToReceiveAudio: 0});

        await pc2.setRemoteDescription(offer);

        await pc1.setLocalDescription(offer);

        const answer = await pc2.createAnswer();

        await pc2.setLocalDescription(answer);

        await pc1.setRemoteDescription(answer);
    } catch (e) {
        console.error("could not establish handshake between peer connections");
    }
}

function gotRemoteStream(e) {
    if (streamedVideo.srcObject !== e.streams[0]) {
        streamedVideo.srcObject = e.streams[0];
    }
    getConnectionStats(pc2);
}

function getConnectionStats() {
    pc2.getStats(null).then(stats => {
        let statsOutput = "";

        stats.forEach(report => {
            if (report.type === "inbound-rtp" && report.kind === "video") {
                Object.keys(report).forEach(statName => {
                    if (monitors.includes(statName)) {

                        let bytesIntegral = parseInt(report[statName]);
                        let timeIntegral = (new Date().getTime() - startTime) / 1000;

                        let bytesPerSecond = bytesIntegral / timeIntegral;

                        statsOutput += `<strong>${statName}:</strong> ${bytesPerSecond} bytes/second <br>\n`;
                    }
                });
            }
        });

        document.querySelector("#stats-box").innerHTML = statsOutput;
    });

    return 0;
}

function startTimer() {
    startTime = new Date().getTime();
}

initiateVideoFeed().then(initiatePeerConnections).then(startTimer).then(connectPeerConnections);

