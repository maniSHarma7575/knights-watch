let streamConfig = {}

let webRtcPeer;
let client;
let pipeline;

window.addEventListener("DOMContentLoaded", () => {
  console.log("DOM fully loaded and parsed");
  const proctoringData = document.getElementById("proctoring-data");
  const { mediaServerUrl } = proctoringData.dataset;
  streamConfig = {
    ws_uri: `wss://${mediaServerUrl}/kurento`,
    ice_servers: undefined,
  };
});

function setIceCandidateCallbacks(webRtcPeer, webRtcEp, onerror)
{
  webRtcPeer.on('icecandidate', function(candidate) {
    // console.log("Local candidate:",candidate);

    candidate = kurentoClient.getComplexType('IceCandidate')(candidate);

    webRtcEp.addIceCandidate(candidate, onerror)
  });

  webRtcEp.on('OnIceCandidate', function(event) {
    let candidate = event.candidate;

    // console.log("Remote candidate:",candidate);

    webRtcPeer.addIceCandidate(candidate, onerror);
  });
}


function startRecordingSingleSession(eventName, user) {
  streamConfig.file_uri = `file:///recordings/${eventName}/${user}-${+new Date()}.webm`;
  let constraints = {
    audio: true,
    video: {
      width: 640,
      framerate: 15,
    },
  };
  let options = {
    mediaConstraints: constraints,
  };

  if (streamConfig.ice_servers) {
    console.log("Use ICE servers: " + streamConfig.ice_servers);
    options.configuration = {
      iceServers : streamConfig.ice_servers
    };
  } else {
    console.log("Use freeice")
  }

  webRtcPeer = kurentoUtils.WebRtcPeer.WebRtcPeerSendrecv(options, function(error)
  {
    if(error) return onError(error)

    this.generateOffer(onStartOffer)
  });
}

function onStartOffer(error, sdpOffer) {
  if (error) return onError(error);

  co(function* () {
    try {
      if (!client) client = yield kurentoClient(streamConfig.ws_uri);

      pipeline = yield client.create("MediaPipeline");

      let webRtc = yield pipeline.create("WebRtcEndpoint");
      setIceCandidateCallbacks(webRtcPeer, webRtc, onError);

      let recorder = yield pipeline.create("RecorderEndpoint", {
        uri: streamConfig.file_uri,
      });

      yield webRtc.connect(recorder);
      yield webRtc.connect(webRtc);

      yield recorder.record();

      let sdpAnswer = yield webRtc.processOffer(sdpOffer);
      webRtc.gatherCandidates(onError);
      webRtcPeer.processAnswer(sdpAnswer);

      // setStatus(CALLING);
    } catch (e) {
      onError(e);
    }
  })();
}

function onError(error) {
  if (error) {
    console.error(error);
    // recorder.stop();
    // pipeline.release();
    // webRtcPeer.dispose();
  }
}