"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var ENV_FIREFOX = 1;
var em_module;
var logFn = function () { };
var userMediaHandler = null;
var mediaStreamHandler = function () { };
var pc_env = 0;
/* The following constants closely reflect the values
 * defined in the the C-land counterpart peerconnection_js.c
 */
var PC_SIG_STATE_UNKNOWN = 0;
var PC_SIG_STATE_STABLE = 1;
var PC_SIG_STATE_LOCAL_OFFER = 2;
var PC_SIG_STATE_LOCAL_PRANSWER = 3;
var PC_SIG_STATE_REMOTE_OFFER = 4;
var PC_SIG_STATE_REMOTE_PRANSWER = 5;
var PC_SIG_STATE_CLOSED = 6;
var PC_GATHER_STATE_UNKNOWN = 0;
var PC_GATHER_STATE_NEW = 1;
var PC_GATHER_STATE_GATHERING = 2;
var PC_GATHER_STATE_COMPLETE = 3;
var DC_STATE_CONNECTING = 0;
var DC_STATE_OPEN = 1;
var DC_STATE_CLOSING = 2;
var DC_STATE_CLOSED = 3;
var DC_STATE_ERROR = 4;
var LOG_LEVEL_DEBUG = 0;
var LOG_LEVEL_INFO = 1;
var LOG_LEVEL_WARN = 2;
var LOG_LEVEL_ERROR = 3;
var connectionsStore = (function () {
    var peerConnections = [null];
    var dataChannels = [null];
    var storeItem = function (store, item) {
        var index = store.indexOf(item);
        if (index === -1)
            index = store.push(item) - 1;
        return index;
    };
    var removeItem = function (store, index) {
        store.splice(index, 1);
    };
    var getItem = function (store, index) {
        return store[index];
    };
    var existsItem = function (store, item) {
        return store.indexOf(item) != -1;
    };
    return {
        storePeerConnection: function (pc) { return storeItem(peerConnections, pc); },
        getPeerConnection: function (index) { return getItem(peerConnections, index); },
        getPeerConnectionByConvid: function (convid) {
            return peerConnections.filter(function (pc) {
                return !!pc && pc.convid === convid;
            });
        },
        removePeerConnection: function (index) { return removeItem(peerConnections, index); },
        storeDataChannel: function (dataChannel) {
            return storeItem(dataChannels, dataChannel);
        },
        getDataChannel: function (index) { return getItem(dataChannels, index); },
        removeDataChannel: function (index) { return removeItem(dataChannels, index); }
    };
})();
function pc_log(level, msg) {
    logFn(level, msg, 0);
}
function sigState(stateStr) {
    var state = PC_SIG_STATE_UNKNOWN;
    switch (stateStr) {
        case "stable":
            state = PC_SIG_STATE_STABLE;
            break;
        case "have-local-offer":
            state = PC_SIG_STATE_LOCAL_OFFER;
            break;
        case "have-remote-offer":
            state = PC_SIG_STATE_REMOTE_OFFER;
            break;
        case "have-local-pranswer":
            state = PC_SIG_STATE_LOCAL_PRANSWER;
            break;
        case "have-remote-pranswer":
            state = PC_SIG_STATE_REMOTE_PRANSWER;
            break;
        case "closed":
            state = PC_SIG_STATE_CLOSED;
            break;
    }
    return state;
}
function ccallLocalSdpHandler(pc, err, type, sdp) {
    em_module.ccall("pc_local_sdp_handler", null, ["number", "number", "string", "string", "string"], [pc.self, err, "avs", type, sdp]);
}
function ccallSignallingHandler(pc, state) {
    em_module.ccall("pc_signalling_handler", null, ["number", "number"], [pc.self, state]);
}
function ccallGatheringHandler(pc, type, sdp) {
    em_module.ccall("pc_gather_handler", null, ["number", "string", "string"], [pc.self, type, sdp]);
}
function ccallConnectionHandler(pc, state) {
    em_module.ccall("pc_connection_handler", null, ["number", "string"], [pc.self, state]);
}
/* Data-channel helpers */
function ccallDcEstabHandler(pc, dc) {
    em_module.ccall("dc_estab_handler", null, ["number", "number"], [pc.self, dc]);
}
function ccallDcStateChangeHandler(pc, state) {
    em_module.ccall("dc_state_handler", null, ["number", "number"], [pc.self, state]);
}
function ccallDcDataHandler(pc, data) {
    em_module.ccall("dc_data_handler", null, ["number", "string", "number"], [pc.self, data, data.length]);
}
function gatheringHandler(pc) {
    var rtc = pc.rtc;
    if (!rtc) {
        return;
    }
    var state = rtc.iceGatheringState;
    pc_log(LOG_LEVEL_INFO, "ice gathering state=" + state);
    switch (state) {
        case "new":
            break;
        case "gathering":
            break;
        case "complete":
            var sdp = rtc.localDescription;
            if (!sdp) {
                return;
            }
            ccallGatheringHandler(pc, sdp.type.toString(), sdp.sdp.toString());
            break;
    }
}
function signallingHandler(pc) {
    var rtc = pc.rtc;
    if (!rtc) {
        return;
    }
    var stateStr = rtc.signalingState;
    pc_log(LOG_LEVEL_INFO, "signalingHandler: state: " + stateStr);
    ccallSignallingHandler(pc, sigState(stateStr));
}
function setMute(pc) {
    var rtc = pc.rtc;
    if (!rtc) {
        return;
    }
    var senders = rtc.getSenders();
    for (var _i = 0, senders_1 = senders; _i < senders_1.length; _i++) {
        var sender = senders_1[_i];
        var track = sender.track;
        if (track && track.kind === "audio") {
            track.enabled = !pc.muted;
        }
    }
}
function connectionHandler(pc) {
    var rtc = pc.rtc;
    if (!rtc) {
        return;
    }
    var state = rtc.iceConnectionState;
    pc_log(LOG_LEVEL_INFO, "connectionHandler state: " + state);
    ccallConnectionHandler(pc, state);
    setMute(pc);
}
function setupDataChannel(pc, dc) {
    var dcHnd = connectionsStore.storeDataChannel(dc);
    dc.onopen = function () {
        pc_log(LOG_LEVEL_DEBUG, "dc-opened");
        ccallDcStateChangeHandler(pc, DC_STATE_OPEN);
    };
    dc.onclose = function () {
        pc_log(LOG_LEVEL_DEBUG, "dc-closed");
        ccallDcStateChangeHandler(pc, DC_STATE_CLOSED);
    };
    dc.onerror = function () {
        pc_log(LOG_LEVEL_DEBUG, "dc-error");
        ccallDcStateChangeHandler(pc, DC_STATE_ERROR);
    };
    dc.onmessage = function (event) {
        pc_log(LOG_LEVEL_DEBUG, "dc-onmessage: data=" + event.data.length);
        ccallDcDataHandler(pc, event.data.toString());
    };
    return dcHnd;
}
function dataChannelHandler(pc, event) {
    var dc = event.channel;
    pc_log(LOG_LEVEL_INFO, "dataChannelHandler: " + dc);
    var dcHnd = setupDataChannel(pc, dc);
    ccallDcEstabHandler(pc, dcHnd);
}
function pc_SetEnv(env) {
    pc_env == env;
}
function pc_New(self, convidPtr) {
    pc_log(LOG_LEVEL_DEBUG, "pc_New");
    var pc = {
        self: self,
        convid: em_module.UTF8ToString(convidPtr),
        rtc: null,
        turnServers: [],
        remote_userid: "",
        remote_clientid: "",
        muted: false,
    };
    var hnd = connectionsStore.storePeerConnection(pc);
    return hnd;
}
function pc_Create(hnd) {
    var pc = connectionsStore.getPeerConnection(hnd);
    if (pc == null) {
        return;
    }
    var config = {
        bundlePolicy: "max-bundle",
        iceServers: pc.turnServers
    };
    pc_log(LOG_LEVEL_INFO, "pc_Create: configuring: " + pc.turnServers.length + " TURN servers");
    var rtc = new RTCPeerConnection(config);
    rtc.onicegatheringstatechange = function () { return gatheringHandler(pc); };
    rtc.oniceconnectionstatechange = function () { return connectionHandler(pc); };
    rtc.onsignalingstatechange = function (event) { return signallingHandler(pc); };
    rtc.ondatachannel = function (event) { return dataChannelHandler(pc, event); };
    rtc.ontrack = function (event) {
        if (mediaStreamHandler != null) {
            mediaStreamHandler(pc.convid, pc.remote_userid, pc.remote_clientid, event.streams);
        }
    };
    pc.rtc = rtc;
}
function pc_Close(hnd) {
    pc_log(LOG_LEVEL_INFO, "pc_Close: hnd=" + hnd);
    var pc = connectionsStore.getPeerConnection(hnd);
    if (pc == null) {
        return;
    }
    var rtc = pc.rtc;
    if (!rtc) {
        return;
    }
    if (rtc != null) {
        rtc
            .getSenders()
            .map(function (sender) { return sender.track; })
            .forEach(function (track) { return track && track.stop(); });
        rtc.close();
        connectionsStore.removePeerConnection(hnd);
    }
}
function pc_AddTurnServer(hnd, urlPtr, usernamePtr, passwordPtr) {
    pc_log(LOG_LEVEL_INFO, "pc_AddTurnServer: hnd=" + hnd);
    var pc = connectionsStore.getPeerConnection(hnd);
    if (pc == null) {
        return;
    }
    var url = em_module.UTF8ToString(urlPtr);
    var username = em_module.UTF8ToString(usernamePtr);
    var credential = em_module.UTF8ToString(passwordPtr);
    var server = {
        urls: url,
        username: username,
        credential: credential
    };
    pc.turnServers.push(server);
}
function sdpMap(sdp, local) {
    var sdpLines = [];
    sdp.split('\r\n').forEach(function (sdpLine) {
        var outline = sdpLine;
        if (local) {
            outline = sdpLine.replace(/^m=(application|video) 0/, 'm=$1 9');
        }
        else {
            if (sdpLine.startsWith('a=sctpmap:')) {
                outline = 'a=sctp-port:5000';
            }
            else if (sdpLine.startsWith('a=tool:')) {
                outline = '';
            }
        }
        if (outline !== undefined && outline !== '') {
            sdpLines.push(outline);
        }
    });
    return sdpLines.join('\r\n');
    ;
}
function createSdp(pc, useAudio, useVideo, useScreenShare, isOffer) {
    var rtc = pc.rtc;
    if (!rtc) {
        return;
    }
    pc_log(LOG_LEVEL_INFO, "setupMedia: a:" + useAudio + " v:" + useVideo + " ss:" + useScreenShare + " offer=" + isOffer);
    if (!userMediaHandler) {
        return;
    }
    userMediaHandler(pc.convid, useAudio, useVideo, useScreenShare)
        .then(function (stream) {
        stream.getTracks().forEach(function (track) {
            rtc.addTrack(track, stream);
            track.enabled = !pc.muted;
        });
        var doSdp = isOffer
            ? rtc.createOffer
            : rtc.createAnswer;
        doSdp
            .bind(rtc)()
            .then(function (sdp) {
            var typeStr = sdp.type;
            var sdpRaw = sdp.sdp || '';
            var sdpStr = sdpRaw;
            pc_log(LOG_LEVEL_INFO, "createSdp: env=" + pc_env);
            if (pc_env === ENV_FIREFOX) {
                sdpStr = sdpRaw.replace(' UDP/DTLS/SCTP', ' DTLS/SCTP');
                sdpStr = sdpMap(sdpStr, true);
            }
            ccallLocalSdpHandler(pc, 0, typeStr, sdpStr);
        })
            .catch(function (err) {
            ccallLocalSdpHandler(pc, 1, "sdp-error", err.toString());
        });
    })
        .catch(function (err) {
        ccallLocalSdpHandler(pc, 1, "media-error", err.toString());
    });
}
function pc_CreateOffer(hnd, useVideo) {
    var pc = connectionsStore.getPeerConnection(hnd);
    if (pc == null) {
        return;
    }
    pc_log(LOG_LEVEL_INFO, "pc_CreateOffer: hnd=" + hnd + " self=" + pc.self.toString(16));
    createSdp(pc, true, useVideo !== 0, false, true);
}
function pc_CreateAnswer(hnd, useVideo) {
    pc_log(LOG_LEVEL_INFO, "pc_CreateAnswer: " + hnd);
    var pc = connectionsStore.getPeerConnection(hnd);
    if (pc == null) {
        return;
    }
    createSdp(pc, true, useVideo !== 0, false, false);
}
function pc_SetRemoteDescription(hnd, typePtr, sdpPtr) {
    pc_log(LOG_LEVEL_INFO, "pc_SetRemoteDescription: hnd=" + hnd);
    var pc = connectionsStore.getPeerConnection(hnd);
    if (pc == null) {
        return;
    }
    var type = em_module.UTF8ToString(typePtr);
    var sdp = em_module.UTF8ToString(sdpPtr);
    var rtc = pc.rtc;
    if (!rtc) {
        return;
    }
    var sdpStr = sdp;
    if (pc_env === ENV_FIREFOX) {
        sdpStr = sdp.replace(/ DTLS\/SCTP (5000|webrtc-datachannel)/, ' UDP/DTLS/SCTP webrtc-datachannel');
        sdpStr = sdpMap(sdpStr, false);
    }
    rtc
        .setRemoteDescription({ type: type, sdp: sdpStr })
        .then(function () { })
        .catch(function (err) {
        pc_log(LOG_LEVEL_WARN, "setRemoteDescription failed: " + err);
    });
}
function pc_SetLocalDescription(hnd, typePtr, sdpPtr) {
    pc_log(LOG_LEVEL_INFO, "pc_SetLocalDescription: hnd=" + hnd);
    var pc = connectionsStore.getPeerConnection(hnd);
    if (pc == null) {
        return;
    }
    var type = em_module.UTF8ToString(typePtr);
    var sdp = em_module.UTF8ToString(sdpPtr);
    var rtc = pc.rtc;
    if (!rtc) {
        return;
    }
    rtc
        .setLocalDescription({ type: type, sdp: sdp })
        .then(function () { })
        .catch(function (err) {
        pc_log(LOG_LEVEL_INFO, "setLocalDescription failed: " + err);
    });
}
function pc_LocalDescription(hnd, typePtr) {
    pc_log(LOG_LEVEL_INFO, "pc_LocalDescription: hnd=" + hnd);
    var pc = connectionsStore.getPeerConnection(hnd);
    var rtc = pc && pc.rtc;
    if (!rtc) {
        return;
    }
    var sdpDesc = rtc.localDescription;
    if (!sdpDesc) {
        return;
    }
    if (typePtr != null) {
        var type = em_module.UTF8ToString(typePtr);
        if (type != sdpDesc.type) {
            pc_log(LOG_LEVEL_WARN, "pc_LocalDescriptiont: wrong type");
            return null;
        }
    }
    var sdp = sdpDesc.sdp.toString();
    var sdpLen = em_module.lengthBytesUTF8(sdp) + 1; // +1 for '\0'
    var ptr = em_module._malloc(sdpLen);
    em_module.stringToUTF8(sdp, ptr, sdpLen);
    return ptr;
}
function pc_IceGatheringState(hnd) {
    pc_log(LOG_LEVEL_INFO, "pc_IceGatheringState: hnd=" + hnd);
    var pc = connectionsStore.getPeerConnection(hnd);
    if (!pc) {
        return 0;
    }
    var rtc = pc.rtc;
    if (!rtc) {
        return;
    }
    var stateStr = rtc.iceGatheringState;
    var state = PC_GATHER_STATE_UNKNOWN;
    switch (stateStr) {
        case "new":
            state = PC_GATHER_STATE_NEW;
            break;
        case "gathering":
            state = PC_GATHER_STATE_GATHERING;
            break;
        case "complete":
            state = PC_GATHER_STATE_COMPLETE;
            break;
    }
    return state;
}
function pc_SignalingState(hnd) {
    pc_log(LOG_LEVEL_INFO, "pc_SignalingState: hnd=" + hnd);
    var pc = connectionsStore.getPeerConnection(hnd);
    if (!pc) {
        return 0;
    }
    var rtc = pc.rtc;
    if (!rtc) {
        return;
    }
    var stateStr = rtc.signalingState;
    var state = sigState(stateStr);
    pc_log(LOG_LEVEL_INFO, "pc_SignalingState: hnd=" + hnd + " " + stateStr + " mapped: " + state);
    return state;
}
function pc_ConnectionState(hnd) {
    pc_log(LOG_LEVEL_INFO, "pc_ConnectionState: hnd=" + hnd);
    var pc = connectionsStore.getPeerConnection(hnd);
    if (!pc) {
        return 0;
    }
    /* Does this need mapping to an int, if it comes as a string,
     * or we return a string???
     */
    var rtc = pc.rtc;
    if (!rtc) {
        return;
    }
    var state = rtc.connectionState;
    return state;
}
function pc_SetMute(hnd, muted) {
    var pc = connectionsStore.getPeerConnection(hnd);
    if (pc == null) {
        return;
    }
    pc.muted = muted !== 0;
    setMute(pc);
}
function pc_GetMute(hnd) {
    var pc = connectionsStore.getPeerConnection(hnd);
    if (pc == null) {
        return;
    }
    return pc.muted;
}
function pc_SetRemoteUserClientId(hnd, useridPtr, clientidPtr) {
    var pc = connectionsStore.getPeerConnection(hnd);
    if (pc == null) {
        return;
    }
    pc.remote_userid = em_module.UTF8ToString(useridPtr);
    pc.remote_clientid = em_module.UTF8ToString(clientidPtr);
}
/* Data Channel related */
function pc_CreateDataChannel(hnd, labelPtr) {
    pc_log(LOG_LEVEL_INFO, "pc_CreateDataChannel: hnd=" + hnd);
    var pc = connectionsStore.getPeerConnection(hnd);
    if (pc == null) {
        return;
    }
    var rtc = pc.rtc;
    if (!rtc) {
        return;
    }
    var label = em_module.UTF8ToString(labelPtr);
    var dc = rtc.createDataChannel(label);
    var dcHnd = 0;
    if (dc != null) {
        dcHnd = setupDataChannel(pc, dc);
    }
    return dcHnd;
}
function pc_DataChannelId(hnd) {
    pc_log(LOG_LEVEL_INFO, "pc_DataChannelId: hnd=" + hnd);
    var dc = connectionsStore.getDataChannel(hnd);
    if (dc == null) {
        return -1;
    }
    return dc.id;
}
function pc_DataChannelState(hnd) {
    pc_log(LOG_LEVEL_INFO, "pc_DataChannelState: hnd=" + hnd);
    var dc = connectionsStore.getDataChannel(hnd);
    if (dc == null) {
        return;
    }
    var str = dc.readyState;
    var state = DC_STATE_ERROR;
    if (str == "connecting") {
        state = DC_STATE_CONNECTING;
    }
    else if (str == "open") {
        state = DC_STATE_OPEN;
    }
    else if (str == "closing") {
        state = DC_STATE_CLOSING;
    }
    else if (str == "closed") {
        state = DC_STATE_CLOSED;
    }
    return state;
}
function pc_DataChannelSend(hnd, dataPtr, dataLen) {
    pc_log(LOG_LEVEL_INFO, "pc_DataChannelSend: hnd=" + hnd);
    var dc = connectionsStore.getDataChannel(hnd);
    if (dc == null) {
        return;
    }
    if (dc.readyState !== 'open') {
        pc_log(LOG_LEVEL_WARN, "pc_DataChannelSend: hnd=" + hnd + " not open");
        return;
    }
    //const data = new Uint8Array(em_module.HEAPU8.buffer, dataPtr, dataLen);
    var data = em_module.UTF8ToString(dataPtr);
    dc.send(data);
}
function pc_DataChannelClose(hnd) {
    pc_log(LOG_LEVEL_INFO, "pc_DataChannelClose: hnd=" + hnd);
    var dc = connectionsStore.getDataChannel(hnd);
    if (dc == null) {
        return;
    }
    dc.close();
}
/* Internal functions, used by avs_wcall directly */
function pc_InitModule(module, logh) {
    em_module = module;
    logFn = logh;
    pc_log(LOG_LEVEL_INFO, "pc_InitModule");
    var callbacks = [
        [pc_SetEnv, "vn"],
        [pc_New, "nns"],
        [pc_Create, "vn"],
        [pc_Close, "vn"],
        [pc_AddTurnServer, "vnsss"],
        [pc_IceGatheringState, "nn"],
        [pc_SignalingState, "n"],
        [pc_ConnectionState, "n"],
        [pc_CreateDataChannel, "ns"],
        [pc_CreateOffer, "nn"],
        [pc_CreateAnswer, "nn"],
        [pc_SetRemoteDescription, "nss"],
        [pc_SetLocalDescription, "nss"],
        [pc_LocalDescription, "sns"],
        [pc_SetMute, "vnn"],
        [pc_GetMute, "nn"],
        [pc_SetRemoteUserClientId, "vnss"],
        [pc_DataChannelId, "nn"],
        [pc_DataChannelState, "nn"],
        [pc_DataChannelSend, "vnsn"],
        [pc_DataChannelClose, "vn"]
    ].map(function (_a) {
        var callback = _a[0], signature = _a[1];
        return em_module.addFunction(callback, signature);
    });
    em_module.ccall("pc_set_callbacks", "null", callbacks.map(function () { return "number"; }), callbacks);
}
function pc_SetUserMediaHandler(umh) {
    userMediaHandler = umh;
}
function pc_SetMediaStreamHandler(msh) {
    mediaStreamHandler = msh;
}
function pc_ReplaceTrack(convid, newTrack) {
    var pcs = connectionsStore.getPeerConnectionByConvid(convid);
    if (pcs.length === 0)
        return;
    for (var _i = 0, pcs_1 = pcs; _i < pcs_1.length; _i++) {
        var pc = pcs_1[_i];
        if (!pc.rtc) {
            continue;
        }
        var senders = pc.rtc.getSenders();
        for (var _a = 0, senders_2 = senders; _a < senders_2.length; _a++) {
            var sender = senders_2[_a];
            if (!sender.track) {
                continue;
            }
            if (sender.track.kind === newTrack.kind) {
                sender.replaceTrack(newTrack);
            }
        }
    }
}
function pc_GetStats(convid) {
    var pcs = connectionsStore.getPeerConnectionByConvid(convid);
    var statsPromises = [];
    var _loop_1 = function (pc) {
        var rtc = pc.rtc;
        if (rtc)
            statsPromises.push(rtc.getStats().then(function (stats) { return ({ userid: pc.remote_userid, stats: stats }); }));
    };
    for (var _i = 0, pcs_2 = pcs; _i < pcs_2.length; _i++) {
        var pc = pcs_2[_i];
        _loop_1(pc);
    }
    return Promise.all(statsPromises);
}
exports.default = {
    init: pc_InitModule,
    setUserMediaHandler: pc_SetUserMediaHandler,
    setMediaStreamHandler: pc_SetMediaStreamHandler,
    replaceTrack: pc_ReplaceTrack,
    getStats: pc_GetStats
};
