import 'babel-polyfill';

// bandwidth limit starts off as unlimited, but can be changed by entering a value in
// the input box. This updates the session storage value and reloads the page.
// -------------------------------------------
var bandwidthLimit = sessionStorage.getItem("bandwidthLimit"); //kbits/second
if (bandwidthLimit === null) {
    bandwidthLimit = 'unlimited';
    // EDIT THIS VALUE TO TOGGLE INITIAL BANDWIDTH LIMIT
}
// -------------------------------------------


// const monitors = ['bytesReceived', 'packetsReceived', 'headerBytesReceived', 'packetsLost', 'totalDecodeTime', 'totalInterFrameDelay', 'codecId'];
const monitors = ['bytesReceived'];
let previousTime;
let prevBytesIntegral = 0;

//local video component
let localVideo = document.querySelector("#gum-local");
let localStream;

//streamed video component
let streamedVideo = document.querySelector("#gum-streamed");

const bandwidthButton = document.querySelector('input#bandwidth_button');
const bandwidthInput = document.querySelector('input#bandwidth_input');

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

    let bitrateInterval = window.setInterval(getConnectionStats, 1000);
//    let latencyInterval = window.setInterval(getLatency, 1000);

    pc2.addEventListener('track', gotRemoteStream);
    localStream.getVideoTracks().forEach(track => pc1.addTrack(track, localStream));
}

async function connectPeerConnections() {
    try {
        let offer = await pc1.createOffer({offerToReceiveVideo: 1, offerToReceiveAudio: 0});
        offer.sdp = setMediaBitrate(offer.sdp, "video", bandwidthLimit);

        await pc2.setRemoteDescription(offer);

        await pc1.setLocalDescription(offer);

        const answer = await pc2.createAnswer();
        answer.sdp = setMediaBitrate(answer.sdp, "video", bandwidthLimit);

        await pc2.setLocalDescription(answer);

        await pc1.setRemoteDescription(answer);
    } catch (e) {
        console.error("could not establish handshake between peer connections");
    }
}

// function getLatency() {
//     pc1.getStats(null).then(stats => {
//         stats.forEach(report => {
//             // console.log("=======================================================");
//
//             Object.keys(report).forEach(statName => {
//                 if (statName === "timestamp") {
//                     let startTime = parseInt(report[statName]);
//                     let currentTime = new Date().getTime();
//                     // console.log(startTime);
//                     document.querySelector("#latency-box").innerHTML = `<strong>transmit latency:</strong> ${currentTime - startTime} ms`;
//                 }
//             });
//
//             // console.log("=======================================================");
//         });
//     });
// }

function setMediaBitrate(sdp, media, bitrate) {
    if (bandwidthLimit == "unlimited") {
        return sdp;
    }
    bandwidthLimit = parseInt(bandwidthLimit);
    var lines = sdp.split("\n");
    // for (var i = 0; i < lines.length; i++) {
    //     if (lines[i].indexOf("m=") === 0) {
    //         console.log(lines[i]);
    //     }
    // }
    var line = -1;
    for (var i = 0; i < lines.length; i++) {
        if (lines[i].indexOf("m="+media) === 0) {
            line = i;
            break;
        }
    }
    if (line === -1) {
        console.debug("Could not find the m line for", media);
        return sdp;
    }
    console.debug("Found the m line for", media, "at line", line);

    // Pass the m line
    line++;

    // Skip i and c lines
    while(lines[line].indexOf("i=") === 0 || lines[line].indexOf("c=") === 0) {
        line++;
    }

    // If we're on a b line, replace it
    if (lines[line].indexOf("b") === 0) {
        console.debug("Replaced b line at line", line);
        lines[line] = "b=AS:"+bitrate;
        return lines.join("\n");
    }

    // Add a new b line
    console.debug("Adding new b line before line", line);
    var newLines = lines.slice(0, line);
    newLines.push("b=AS:"+bitrate);
    newLines = newLines.concat(lines.slice(line, lines.length));
    return newLines.join("\n");
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
                        let currentTime = new Date().getTime();
                        let timeIntegral = (currentTime - previousTime) / 1000;
                        let kbytesPerSecond = (bytesIntegral-prevBytesIntegral) / timeIntegral / 1000;
                        prevBytesIntegral = bytesIntegral;
                        previousTime = currentTime;

                        statsOutput += `<strong>kilobit rate:</strong> ${(kbytesPerSecond * 8).toFixed(2)} kb/s <br>\n`;
                    }
                });
            }
        });

        document.querySelector("#bitstream-box").innerHTML = statsOutput;
    });

    return 0;
}

function startTimer() {
    previousTime = new Date().getTime();
}

// when button clicked set new bandwidthLimit to session storage and reload
bandwidthButton.onclick = () => {
  bandwidthLimit = document.getElementById("bandwidth_input").value;
  sessionStorage.setItem("bandwidthLimit", bandwidthLimit);
  location.reload();
};

// Execute a function when the user releases a key on the keyboard
bandwidthInput.addEventListener("keyup", function(event) {
  // Number 13 is the "Enter" key on the keyboard
  if (event.keyCode === 13) {
    // Cancel the default action, if needed
    event.preventDefault();
    // Trigger the button element with a click
    document.getElementById("bandwidth_button").click();
  }
});


document.querySelector("#bitratelimit-box").innerHTML = `<strong>bitrate limit:</strong> ${bandwidthLimit} kb/s`;

initiateVideoFeed().then(initiatePeerConnections).then(startTimer).then(connectPeerConnections);
