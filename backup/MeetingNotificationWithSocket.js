import React, { useEffect, useRef, useState } from 'react';
import { toast } from 'react-toastify';
import { chimeMeetingSocketApiUrl } from '../api/endpoints';
import { io } from 'socket.io-client';
import {
  getAccessTokenFromLS,
  getPhoneId,
  getUserType,
  getWebsiteAccessTokenFromLS,
} from '../utility/util';
import {
  meetingRejectedAction,
  saveWebSocketRefAction,
} from '../redux/actions/meetingAction';
import { useDispatch } from 'react-redux';
import { saveWebsiteWebSocketRefAction } from '../redux/actions/WebsiteActions/websiteMeetingAction';
import {
  acceptCall,
  cancelCall,
  endCall,
  rejectCall,
  startCall,
} from '../utility/socketConstant';
import { withRouter } from 'react-router';
import ringtone from '../../assets/ringtones/forChromeAndOthers.wav';
import CallKit from '../components/Modals/callKit';

// Currently in Use for Meeting Socket (Patient & Doctor) #VideoCall

function MeetingNotificationWithSocket(props) {
  const ws = useRef(null);
  const callingRes = useRef(null);
  const ringtoneAudioNotification = useRef(null);
  let toastId = useRef(null);
  const { history } = props;
  const [isCalling, setIsCalling] = useState(false);
  const dispatch = useDispatch();

  useEffect(() => {
    connectToSocket();

    return () => {
      ws.current.off(startCall, notificationStartListner);
      ws.current.off(cancelCall, notificationCancelListner);
      ws.current.off(endCall, notificationEndCallListner);
      ws.current.off(acceptCall, notificationAcceptCallListner);
      ws.current.off(rejectCall, notificationRejectCallListner);
    }
  }, [])

  const connectToSocket = () => {
    debugger;
    ws.current = io(
      `${chimeMeetingSocketApiUrl}?authorization=${
        getUserType() == 1
          ? getWebsiteAccessTokenFromLS()
          : getAccessTokenFromLS()
      }&userType=${getUserType()}&phone_id=${getPhoneId()}`,
      { transports: ['websocket'] },
    );
    console.log(ws.current.connected, '*******connecting to Socket******')
    ws.current.on('connect', () => {
      console.log(ws.current.connected, '*******connected******');
      getUserType() == 1
        ? dispatch(saveWebsiteWebSocketRefAction(ws?.current))
        : dispatch(saveWebSocketRefAction(ws?.current));
      ws.current.on(startCall, notificationStartListner);
      ws.current.on(cancelCall, notificationCancelListner);
      ws.current.on(endCall, notificationEndCallListner);
      ws.current.on(acceptCall, notificationAcceptCallListner);
      ws.current.on(rejectCall, notificationRejectCallListner);
    });

    ws.current.on('disconnect', (reason) => {
      setTimeout(() => {
        if (navigator?.onLine) connectToSocket()
      }, 1000);
      console.log(
        ws.current.connected,
        `*******${reason}****** will attempt to reconnect in 1sec`,
      );
    })

    ws.current.on('connect_error', (err) => {
      console.log(err.message, '*******connect_error******');
      ws.current.close();
    })
  }

  const notificationAcceptCallListner = (res) => {
    console.log('Listener, notificationAcceptCallListner', res);
    if (res.code == 200) {
      toast.dismiss(toastId);
      stopRingtone();
    }
  }

  const notificationRejectCallListner = (res) => {
    console.log('Listener, notificationRejectCallListner', res);
    if (res.code == 200) {
      toast.dismiss(toastId);
      stopRingtone();
    }
  }

  const cancelCallHandler = () => {
    stopRingtone();
    meetingRejectedAction(
      {
        call_rejected: 1,
        event_id: callingRes.current.result.eventId,
      },
      getUserType() == 1 ? 'patient' : 'doctor',
    );
    if (getUserType() == 1) {
      ws.current.emit(cancelCall, {
        eventId: callingRes.current.result.eventId,
        toUserId: callingRes.current.result.fromUserId,
        toUserType: 2,
      });
      ws.current.emit(rejectCall, {
        eventId: callingRes.current.result.eventId,
        accessToken: getWebsiteAccessTokenFromLS(),
      });
    } else {
      ws.current.emit(cancelCall, {
        eventId: callingRes.current.result.eventId,
        toUserId: callingRes.current.result.fromUserId,
        toUserType: 1,
      });
      ws.current.emit(rejectCall, {
        eventId: callingRes.current.result.eventId,
        accessToken: getAccessTokenFromLS(),
      });
    }
    toast.dismiss(toastId);
  }

  const notificationStartListner = (res) => {
    console.log('Listener, notificationStartListner', res);
    if (res) {
      callingRes.current = res;
    }
    if (res.code == 200) {
      console.log('connected to on startcall socked ------->>>>>>>>>>', res);
      playRingtone();
      // setIsCalling(true)
      if (!toast.isActive(toastId)) {
        return (toastId = toast.warn(
          <div className="incoming-call-toaster">
            <p className="bold">{`${res.result.fromUserName} is calling...`}</p>
            <br />
            <div className="justify-end">
              <button
                className="btn btn-delete small mr-20"
                onClick={cancelCallHandler}
                style={{ position: 'initial', display: 'block' }}
              >
                Decline
              </button>
              <button
                className="btn btn-primary small"
                style={{ position: 'initial', display: 'block' }}
                onClick={() => acceptCallHandler(res)}
              >
                Accept
              </button>
            </div>
          </div>,
          {
            toastId: toastId,
            className: 'toast-success toaster-for-incoming-call',
            autoClose: 120000,
            // closeOnClick: false,
          },
        ));
      }
      return;
    }
  }

  const acceptCallHandler = (res) => {
    console.log("Call Accepted from Toast");
    toast.dismiss(toastId);
    ws.current.emit(acceptCall, {
      eventId: callingRes.current.result.eventId,
      accessToken:
        getUserType() == 1
          ? getWebsiteAccessTokenFromLS()
          : getAccessTokenFromLS(),
    });
    stopRingtone();
    getUserType() == 1
      // ? history.push(
      //     `/my-appointments/detail/${res.result.eventId}/meeting?join=true`,
      //   )
      ? history.push(
        `/chime/detail/${res.result.eventId}/meeting?join=true`,
      )
      // : history.push(
      //     `/appointments/appointment-detail/${res.result.eventId}/meeting?join=true`,
      //   )
      : history.push(
        `/appointments/appointment-detail/meeting-chime/${res.result.eventId}/meeting?join=true`,
      );
  }

  const notificationCancelListner = (args) => {
    console.log('Listener, notificationCancelListner', args);
    console.log('connected to on cancel-call socket ------->>>>>>>>>>', args);
    toast.dismiss(toastId);
    if (args.code == 200) {
      stopRingtone();
    }
  }

  const notificationEndCallListner = (args) => {
    console.log('Listener, notificationEndCallListner', args);
    if (args.code == 200) {
      toast.dismiss(toastId);
      stopRingtone();
    }
  }

  const playRingtone = () => {
    if(ringtoneAudioNotification && ringtoneAudioNotification.current) {
      var playedPromise = ringtoneAudioNotification.current.play();
      if (playedPromise) {
        playedPromise
          .catch((e) => {
            console.log(e);
            if (e.name === 'NotAllowedError' || e.name === 'NotSupportedError') {
              console.log(e.name);
            }
          })
          .then(() => {
            console.log('playing sound !!!');
          })
      }
    }
  }

  const stopRingtone = () => {
    setIsCalling(false);
    if(ringtoneAudioNotification && ringtoneAudioNotification.current)
    {
      ringtoneAudioNotification.current.pause();
      ringtoneAudioNotification.current.currentTime = 0;
    }
  }

  return (
    <>
      <audio
        className={'d-none'}
        id="audio1"
        ref={ringtoneAudioNotification}
        controls="controls"
        preload="auto"
        src={ringtone}
        loop="loop"
        type="audio/wav"
      ></audio>
      {isCalling && (
        <CallKit
          res={callingRes.current}
          acceptCallHandler={acceptCallHandler}
          cancelCallHandler={cancelCallHandler}
        />
      )}
    </>
  )
}

export default withRouter(MeetingNotificationWithSocket)
