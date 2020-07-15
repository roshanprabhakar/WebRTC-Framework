//video stream source object
let stream;

//stream capture dimensions
let width = 700;
let height = 500;

//local video component
let localVideo = document.querySelector("#gum-local");
let localCanvas = document.querySelector("#canvas-local");
let localCanvasContext = localCanvas.getContext('2d');

//streamed video component
let streamedVideo = document.querySelector("#gum-streamed");
let streamCanvas = document.querySelector("#stream-canvas");
let streamedCanvasContext = streamCanvas.getContext('2d');

//peer connections for streaming (data streamed from pc2 -> pc1)
let pc1;
let pc2;

//data channel to send all necessary data
let rtcDataChannel;

//establishes the the transfer of ice candidate objects. this would normally be done through a signaling intermediary
async function onIceCandidate(pc, event) {
    await (getOtherPc(pc).addIceCandidate(event.candidate));
}

//returns the alternate peer connection given the peer connection parameter
function getOtherPc(pc) {
    return (pc === pc1) ? pc2 : pc1;
}


//initiates gum feed from webcam, displays this in the gum-local video element.
let initiateLocalCameraFeed = async function () {

    //sets appropriate attributes in the html rendering
    localCanvas.width = width;
    localCanvas.height = height;

    //initializes (g)er(U)ser(M)edia stream to gum-local
    try {
        stream = await navigator.mediaDevices.getUserMedia({
            video: {
                width: width,
                height: height
            },
            audio: false //only retrieving video information
        });
        localVideo.srcObject = stream;

    } catch (e) {
        console.error("could not initiate local camera feed");
    }

}

//streams content from gum-local between two peer connections through an RTCDataChannel connection object
let initiateConnectionStream = async function () {

    //instantiates first peer connection (this will be the receiving end)
    pc1 = new RTCPeerConnection({});

    //upon receiving ice candidate, configures second peer connection with the local ice candidate
    pc1.addEventListener('icecandidate', e => onIceCandidate(pc1, e));

    //instantiates a data channel connecting pc1 to whichever other peer connection pc1 is connected to
    const channel = pc1.createDataChannel("label");

    //dictates instructions upon receiving a message on pc1's connection end
    let messageIndex = 0 //counts the number of messages received at this node
    packet = [] //a complete packet is merged into a frame and rendered immediately (packets/frames aren't queued)
    let frame; //ImageData object representing the merged packet
    channel.onmessage = function (event) {

        if (messageIndex === 0) { //the first message received details dimensions for the rendering canvas element
            const dimension = JSON.parse(event.data);
            streamCanvas.width = parseInt(dimension.width);
            streamCanvas.height = parseInt(dimension.height);
        } else { //every other received message contains frame information
            packet.push(event.data); //adds received data to the frame packet

            if (packet.length === 7 || packet.length === 6 || packet.length === 5) { //frames are broken into ~7 chunks for transmission
                let frameBuffer = mergeList(packet); //merge arraybuffers contained in packet into a single buffer depicting an ImageData object skeleton

                //converting the frameBuffer arraybuffer into an ImageData object
                let arrayFrame = new Uint8ClampedArray(frameBuffer);
                frame = new ImageData(arrayFrame, width, height);

                //projects loaded data into the canvas object detailing the rendered object
                streamedCanvasContext.putImageData(frame, 0, 0);

                //packet reset after the contained frame is rendered
                packet = [];
            }

        }
        messageIndex++;
    }

    //instantiates the second node of the pc1's peer connection channel
    pc2 = new RTCPeerConnection({});

    //adds the ice candidate event listener to listen for pc1's ice configuration
    pc2.addEventListener('icecandidate', e => onIceCandidate(pc2, e));

    //on the creation of an RTCDataChannel between pc1 and pc2, execute the following commands
    pc2.ondatachannel = function (event) {

        //sets the connection event in the global context so that other methods can send data through the channel
        rtcDataChannel = event.channel;

        //as soon as the connection is instantiated, an object dictating the frame dimensions of the rendering side is transmitted
        rtcDataChannel.onopen = function (event) {
            rtcDataChannel.send(JSON.stringify({
                width: width,
                height: height
            }));
        }
    }

    //after the appropriate listeners are added to the peer connection, the connection is actually instantiated through ice exchanges
    try {

        //this object is what would be transmitted through the intermediary server to propose the connection
        let offer = await pc1.createOffer({offerToReceiveVideo: 1, offerToReceiveAudio: 0});

        //on the receiving end, this accepts the invitation (offer object)
        await pc2.setRemoteDescription(offer);

        //cements connection
        await pc1.setLocalDescription(offer);

        //pc2 response to the request
        const answer = await pc2.createAnswer();

        //pc2 response is set locally
        await pc2.setLocalDescription(answer);

        //pc1 response is set locally
        await pc1.setRemoteDescription(answer);

        //end connection establishment
    } catch (e) {
        //connection could not be established, streaming cannot proceed
        console.error("could not establish handshake between peer connections");
    }

    //after the connection is established, video begins to stream
    localVideo.addEventListener('play', function () {
        localVideo.play();

        //starts sending data on a frame by frame basis
        setTimeout(transmitLoop, 1000 / 50); //transmits at fps=50 (assumes processing time = 0 which is obviously not true)
    });
}

//reads and transmits frames through the globally accessible peer connection and data channel objects
function transmitLoop() {
    if (localVideo && !localVideo.paused && !localVideo.ended) { //ensures stream is still being generated

        //needed to convert video data to ImageData readable
        localCanvasContext.drawImage(localVideo, 0, 0, width, height);

        //retrieves the arraybuffer representing the frame on the localCanvasContext
        let buffer = localCanvasContext.getImageData(0, 0, width, height).data.buffer;

        //splits the buffer into 6 segments of the original.
        //this is done because of an observed cap on the size of data that can be transmitted (roughly average buffer size / 6)
        let splitBuffer = split(buffer, 6);

        //ensures that the data channel on which streaming is to occur is in the correct acceptance state
        switch (rtcDataChannel.readyState) {
            case "open":

                //individually send all frame segments to the receiving end
                for (let i = 0; i < splitBuffer.length; i++) {
                    rtcDataChannel.send(splitBuffer[i]);
                }

                //terminates switch
                break;
        }

        //runs transmission on repeat witha  1000/5 millisecond delay in between each transmission
        setTimeout(transmitLoop, 1000 / 5);
    }
}

//function responsible for reconstructing an image frame buffer from the individual packet segments that are sent over the data channel
function mergeList(bufferList) {
    if (bufferList.length === 1) return bufferList;

    let concatenated = concat(bufferList[0], bufferList[1]);

    if (bufferList.length > 2) {
        for (let i = 2; i < bufferList.length; i++) {
            concatenated = concat(concatenated, bufferList[i]);
        }
    }

    return concatenated;
}

//merges two different arraybuffers into a single array buffer
function concat(buffer1, buffer2) {
    let tmp = new Uint8Array(buffer1.byteLength + buffer2.byteLength);
    tmp.set(new Uint8Array(buffer1), 0);
    tmp.set(new Uint8Array(buffer2), buffer1.byteLength);
    return tmp.buffer;
}

//splits an arraybuffer into n individual segments, returns an array of the segments
function split(arraybuffer, n) {
    let list = [];

    let cap = arraybuffer.byteLength - (arraybuffer.byteLength % n);

    let index = 0;
    while (index + cap / n < arraybuffer.byteLength) {
        list.push(arraybuffer.slice(index, index + cap / n));
        index += cap / n;
    }
    list.push(arraybuffer.slice(index, index + cap / n));

    return list;
}

//initializes media feed on the input end, then initializes the stream and stream renderer
initiateLocalCameraFeed().then(r => initiateConnectionStream());
