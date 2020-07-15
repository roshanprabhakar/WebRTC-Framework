
//initialize media source used as stream
const constraints = window.constraints = {
    audio: false,
    video: true
};

let stream;

//start streaming from gUM video input
async function init(e) {
    try {
        stream = await navigator.mediaDevices.getUserMedia(constraints);
        handleSuccess(stream);
        e.target.disabled = true;
    } catch (e) {
        handleError(e);
    }
}

function onAddIceCandidateSuccess(pc) {
    console.log(`${getName(pc)} addIceCandidate success`);
}

//if the stream is successfully instantiated, start a video track and begin the stream
function handleSuccess(stream) {
    const video = document.querySelector('#gum-local');
    const videoTracks = stream.getVideoTracks();
    console.log('Got stream with constraints:', constraints);
    console.log(`Using video device: ${videoTracks[0].label}`);
    window.stream = stream;
    video.srcObject = stream;
}

//display the appropriate error message for the passed error
function handleError(error) {
    if (error.name === 'ConstraintNotSatisfiedError') {
        const v = constraints.video;
        errorMsg(`The resolution ${v.width.exact}x${v.height.exact} px is not supported by your device.`);
    } else if (error.name === 'PermissionDeniedError') {
        errorMsg('Permissions have not been granted to use your camera and ' +
            'microphone, you need to allow the page access to your devices in ' +
            'order for the demo to work.');
    }
    errorMsg(`getUserMedia error: ${error.name}`, error);
}

//display error message to console
function errorMsg(message, error) {
    const errorElement = document.querySelector('#errorMsg');
    errorElement.innerHTML += `<p>${message}</p>`;
    if (typeof error !== 'undefined') {
        console.error(error);
    }
}

//initialize the streaming process
document.querySelector('#showVideo').addEventListener('click', e => init(e));

//stream data from one video to another
document.getElementById('gum-local').addEventListener('canplay', e => {
    document.getElementById('gum-streamed').srcObject = document.getElementById('gum-local').captureStream();
});

