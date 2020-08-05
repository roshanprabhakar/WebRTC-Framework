# WebRTC Framework for STEM to SHTEM 2020

Each javascript template is linked to an html file. To run a selection, open the html file in your browser.

### Run
```sh
open ./html/template -a browser
```
Note only the generic stream provides an interface which allows for the throttling of network bandwidth

## Streaming Generic Video

- Streams video data through a WebRTC configured channel
- SDP and all corresponding metadata configured by the connection nodes (with the exception of bandwidth limits)
- You can introduce a bandwidth limit to observe performance at different network capacities

## Streaming Full Frames

- Streams uncompressed video data through an RTCDataChannel
- Each frame is sent as an array of bytes where each byte represents the r, g, b, a value of some pixel in the corresponding frame, for all pixels present in the frame
- An api for splitting these frames and merging them has been implemented and deployed as frames in their uncompressed forms are too large to send in a single transmission

## Streaming Blue Ratio

- Streams the ratio of blue pixels to the number of total pixels in each frame as an integer percentage
- Implemented for the purposes of proving that the transmission of less data does in fact improve net latency, even in the situation that both the transmitor and receiver nodes operate on the same machine. 
