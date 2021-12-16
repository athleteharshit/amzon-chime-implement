import React, { useEffect, useRef, useState } from "react";
import "./Chime.css";
import {
	ConsoleLogger,
	DefaultDeviceController,
	LogLevel,
} from "amazon-chime-sdk-js";
import {
	VideoTileGrid,
	useMeetingManager,
	useMeetingStatus,
	useRemoteVideoTileState,
	useAudioVideo,
	useLocalVideo,
	useRosterState,
	useMeetingEvent,
	useAttendeeStatus,
	useToggleLocalMute,
} from "amazon-chime-sdk-component-library-react";
import MeetingControls from "./components/meetingControls";
import MeetingRoster from "./components/MeetingRoster";

import { Icon, Message } from "semantic-ui-react";
import HospitalWebsiteLayout from "../HospitalWebsite/HospitalWebsiteLayout";
import ProperInternetConenction from "../../components/Modals/ProperInternetConenction/ProperInternetConenction";
import {
	getWebsiteAccessTokenFromLS,
	isHospitalWebsite,
	SecondsToHMSConvertor,
	setCurrentCountryCodeToLS,
	setGuestUser,
	setWebsiteAccessTokenInLS,
	setWebsiteCountryCodeInLS,
} from "../../utility/util";
import MeetingNotificationWithSocket from "../../socket/MeetingNotificationWithSocket";
import {
	checkIsUserComingForConsValid,
	getAppointmentDetailForWebsiteAction,
	getAppointmentDetailForWebsiteAction2,
	resetWebsiteAppointmentDetailAction,
} from "../../redux/actions/WebsiteActions/appointmentsAction";
import { useDispatch, useSelector } from "react-redux";
import { toast } from "react-toastify";
import { toastIdsConstant } from "../../utility/toastIdsConstant";
import {
	clearWebsiteChimeMeetingDataAction,
	getWebsiteMeetingAction,
	websiteMeetingJoinedAction,
} from "../../redux/actions/WebsiteActions/websiteMeetingAction";
import { cancelCall, endCall, startCall } from "../../utility/socketConstant";
import UserIsNotOnlineForCall from "../../components/Modals/UserIsNotOnlineForCall";
import MeeetingDuration from "../../components/Modals/MeeetingDuration/MeeetingDuration";
import DoctorCancelMeeting from "../../components/Modals/DoctorCancelMeeting/DoctorCancelMeeting";
import UserNotAvailableForCall from "../../components/Modals/UserNotAvailableForCall";
import CallEndByPatient from "../../components/Modals/CallEndByPatient/CallEndByPatient";
import UserTryingtoNavigate from "../../components/WebsiteComponents/WebsiteModals/UserTryingtoNavigate";
import {
	canJoinCall,
	printDifference,
} from "../../utility/appointmentConstant";
import { canWeShowStartConsultationBtn } from "../../utility/websiteConstant/appointmentConstant";
import { DATA_MESSAGE_TOPIC } from "../../utility/meetingConstant";

import audioOffImg from "../../../assets/calling-icons/audio-off.svg";
import audioOnImg from "../../../assets/calling-icons/audio-on.svg";
import videoOffImg from "../../../assets/calling-icons/video-off.svg";
import videoOnImg from "../../../assets/calling-icons/video-on.svg";
import ringtone from "../../../assets/ringtones/calling.wav";
import ErrorImage from "../../../assets/user_placeholder.svg";
import MyCustomLoader from "../../components/MyCustomLoader/MyCustomLoader";

// Currently in Use for Patient #VideoCall

function Chime(props) {
	let seconds = 0;
	const meetingManager = useMeetingManager();
	const ringtoneAudio = useRef(null);
	let audioVideo = useAudioVideo();
	const { roster } = useRosterState();
	const meetingEvent = useMeetingEvent();
	const { isVideoEnabled, toggleVideo } = useLocalVideo();
	const { toggleMute } = useToggleLocalMute();
	const { tiles } = useRemoteVideoTileState();
	const meetingStatus = useMeetingStatus();
	const [attndeeId, setAttndeeId] = useState("");
	const { videoEnabled } = useAttendeeStatus(attndeeId || "");
	const [privewVideos, setPrivewVideos] = useState(true);
	const [cameraOn, setCameraOn] = useState(true);
	const [audioMuted, setAudioMuted] = useState(true);
	const [isMeetinigJoin, setIsMeetingJoin] = useState(false);
	const [onlyOnce, setOnlyOnce] = useState(false);
	const [onlyOnceAudio, setOnlyOnceAudio] = useState(false);
	const [showProperInternetConenction, setShowProperInternetConenction] =
		useState(false);
	const [eventId, setEventId] = useState(null);
	const [isApiLoadingToCheckEligibility, setIsApiLoadingToCheckEligibility] =
		useState(false);
	const dispatch = useDispatch();
	const [consultationtime, setConsultationtime] = useState(0);
	const overallMeetingTimer = useRef();
	const isUserJoinTheCall = useRef();
	const { socketRef } = useSelector((state) => state?.websiteSocket);
	const [showModalUserNotAvailable, setShowModalUserNotAvailable] =
		useState(false);
	const { appointmentDetailApiData, isApiLoading } = useSelector(
		(state) => state?.websiteAppointmentDetail
	);
	const [showFinishConsultation, setShowFinishConsultation] = useState(false);
	const [
		meetingEndPopupWhenDoctorCancelCall,
		setMeetingEndPopupWhenDoctorCancelCall,
	] = useState(false);
	const [userCancelTheCall, setUserCancelTheCall] = useState(false);
	const { meetingApiData, isApiLoading: isEventLoading } = useSelector((state) => state?.websiteMeeting);
	const [showDialogCustomerCutTheCall, setShowDialogCustomerCutTheCall] =
		useState(false);
	const [
		isCallInitiatedApiCallTakesPlace,
		setIsCallInitiatedApiCallTakesPlace,
	] = useState(false);
	const [isUserTryingtoNavigate, setIsUserTryingtoNavigate] = useState(false);
	const [
		leaveMettingDueToPatientUnavailability,
		setLeaveMettingDueToPatientUnavailability,
	] = useState(false);
	const [internetTimeout, setInternetTimeout] = useState(false);
	const [checkIfInternetComebackIn30ec, setCheckIfInternetComebackIn30ec] =
		useState(null);
	const [checkIfPatientComebackIn30Sec, setCheckIfPatientComebackIn30Sec] =
		useState(null);
	const [ispatientPause, setIspatientPause] = useState(false);
	const [videoBlock, setVideoBlock] = useState(false);
	const [audioBlock, setAudioBlock] = useState(false);
	const internetTimeoutId = useRef();
	const videoElement = useRef();
	const timeout = useRef();
	let attendees = Object.values(roster);
	const [isValidated, setIsValidated] = useState(false);

	const logger = new ConsoleLogger("sdk", LogLevel.INFO);
	const deviceController = new DefaultDeviceController(logger, {
		enableWebAudio: true,
	});

	const previewVideo = async () => {
		const deviceList = await deviceController.listVideoInputDevices();
		setVideoBlock(deviceList[0]?.label === "" ? false : true);
		await deviceController.chooseVideoInputDevice(deviceList[0].deviceId);
		deviceController.startVideoPreviewForVideoInput(videoElement.current);
		const audioList = await deviceController.listAudioInputDevices();
		setAudioBlock(audioList[0].label === "" ? false : true);
	};

	const privewVideoStop = async () => {
		await deviceController.stopVideoPreviewForVideoInput(videoElement.current);
	};

	useEffect(() => {
		if (props?.location?.search !== "?join=true") {
			previewVideo();
		}
		return () => {
			if (privewVideos && props?.location?.search !== "?join=true") {
				privewVideoStop();
			}
		};
	}, []);

	useEffect(() => {
		const getAttendeeId = () => {
			attendees.map((attendee) => {
				const { chimeAttendeeId } = attendee || {};
				// console.log("tiless", attendee);
				if (
					!(
						meetingEvent &&
						meetingEvent?.attributes?.attendeeId === chimeAttendeeId
					)
				) {
					// console.log("tiless", chimeAttendeeId);
					setAttndeeId(chimeAttendeeId);
					return;
				}
			});
			return "";
		};
		getAttendeeId();
	}, [roster]);

	useEffect(() => {
		const onlineInterval = setInterval(() => {
			handleOnlineNetwork();
		}, 1000);

		//non-logged in flow when user come from email link for consultation
		if (
			isHospitalWebsite() &&
			props?.match?.params?.id?.includes("k") &&
			props?.match?.params?.id?.includes("e")
		) {
			const len = window.location.href?.split("/")?.length - 1;
			const qParams = {
				k: window.location.href?.split("/")[len].split("&")[0]?.substring(2),
				e: window.location.href?.split("/")[len].split("&")[1]?.substring(2),
			};
			setIsApiLoadingToCheckEligibility(true);
			dispatch(checkIsUserComingForConsValid(qParams))
				.then((res) => {
					setIsValidated(true);
					// <MeetingNotificationWithSocket />;
					res?.data?.guest_user != null &&
						setGuestUser(res?.data?.guest_user == 0 ? false : true);
					if (!socketRef) {
						console.log("socketRef", socketRef);
					}
					setIsApiLoadingToCheckEligibility(false);
					setEventId(res?.data?.event_id);
					setCurrentCountryCodeToLS("ke");
					if (!getWebsiteAccessTokenFromLS()) {
						setWebsiteAccessTokenInLS(res.data.access_token);
					}
					dispatch(getAppointmentDetailForWebsiteAction2(res?.data?.event_id));
				})
				.catch((error) => {
					if (!toast.isActive(toastIdsConstant.apiFailure)) {
						return (toastIdsConstant.apiFailure = toast.warn(
							error?.response?.messages[0],
							{
								toastId: toastIdsConstant.apiFailure,
								className: "toast-warn",
							}
						));
					}
					return;
				});
		}

		return async () => {
			clearInterval(onlineInterval);
			clearInterval(overallMeetingTimer.current);
			clearTimeout(checkIfPatientComebackIn30Sec);
			dispatch(resetWebsiteAppointmentDetailAction());
			dispatch(clearWebsiteChimeMeetingDataAction());
			await meetingManager?.leave();
		};
	}, []);

	useEffect(() => {
		if (!navigator.onLine) {
			checkIfInternetComebackIn30Sec();
		} else clearTimeout(checkIfInternetComebackIn30ec);
	}, [navigator.onLine]);

	useEffect(() => {
		if (internetTimeout) {
			handleEndCallHandler();
			props.history.replace(
				`/my-appointments/detail/${eventId ?? props?.match?.params?.id}`
			);
		}
	}, [internetTimeout]);

	useEffect(() => {
		if (
			tiles.length > 0 &&
			checkIfPatientComebackIn30Sec &&
			!leaveMettingDueToPatientUnavailability
		) {
			clearTimeout(checkIfPatientComebackIn30Sec);
		}
		// patient come back after reconnecting to wifi
		if (leaveMettingDueToPatientUnavailability) {
			clearTimeout(checkIfInternetComebackIn30ec);
		}
	}, [
		tiles,
		checkIfPatientComebackIn30Sec,
		leaveMettingDueToPatientUnavailability,
	]);

	useEffect(() => {
		if (isCallInitiatedApiCallTakesPlace) {
			stopRingtone();
		}
	}, [isCallInitiatedApiCallTakesPlace]);

	useEffect(() => {
		if (props?.match?.params?.id && !props?.match?.params?.id?.includes("k")) {
			dispatch(getWebsiteMeetingAction(props?.match?.params?.id));
		}
	}, []);

	useEffect(() => {
		if (eventId) {
			dispatch(getWebsiteMeetingAction(eventId));
		}
	}, [eventId]);

	useEffect(() => {
		if (socketRef) {
			console.log("Cancel Called");
			socketRef.on(cancelCall, (res) => {
				console.log("Cancel Called Inside");
				stopRingtone();
				setUserCancelTheCall(true);
			});
		}
	}, [socketRef]);

	// useEffect(() => {
	// 	if (!appointmentDetailApiData) {
	// 		if (
	// 			props?.match?.params?.id &&
	// 			!props?.match?.params?.id?.includes("k")
	// 		) {
	// 			dispatch(
	// 				getAppointmentDetailForWebsiteAction2(props?.match?.params?.id)
	// 			);
	// 		}
	// 	}
	// }, [appointmentDetailApiData]);

	useEffect(() => {
		// if (
		// 	props?.match?.params?.id &&
		// 	!props?.match?.params?.id?.includes("k")
		// ) {
		dispatch(getAppointmentDetailForWebsiteAction2(props?.match?.params?.id));
		// }
	}, []);

	useEffect(() => {
		if (tiles?.length > 0 && !isCallInitiatedApiCallTakesPlace) {
			clearInterval(isUserJoinTheCall.current);
			callDurationApi();
		}
		// when doctor end the call
		if (
			tiles?.length == 0 &&
			isCallInitiatedApiCallTakesPlace &&
			meetingStatus == 1 &&
			!leaveMettingDueToPatientUnavailability
		) {
			clearInterval(isUserJoinTheCall.current);
		}
	}, [
		tiles,
		isCallInitiatedApiCallTakesPlace,
		meetingStatus,
		leaveMettingDueToPatientUnavailability,
	]);

	useEffect(() => {
		// when user join meeting from push notification
		if (
			props.location.search == "?join=true" &&
			meetingApiData &&
			!isCallInitiatedApiCallTakesPlace &&
			!isMeetinigJoin
		) {
			joinMeeting();
		}
	}, [
		props.location.search,
		meetingApiData,
		isCallInitiatedApiCallTakesPlace,
		isMeetinigJoin,
	]);

	useEffect(() => {
		if (!isVideoEnabled && meetingStatus === 1 && !onlyOnce && cameraOn) {
			toggleVideo();
			setOnlyOnce(true);
		}
	}, [isVideoEnabled, meetingStatus, cameraOn, onlyOnce]);

	useEffect(() => {
		if (meetingStatus === 1 && !onlyOnceAudio && !audioMuted) {
			toggleMute();
			setOnlyOnceAudio(true);
		}
	}, [meetingStatus, onlyOnceAudio, audioMuted]);

	useEffect(() => {
		if (audioVideo) {
			audioVideo.realtimeSubscribeToAttendeeIdPresence(
				(attendeeId, present, externalUserId, dropped) => {
					if (
						meetingApiData?.chime_meeting_data?.Attendee
							.AttendeeId &&
						attendeeId &&
						meetingApiData?.chime_meeting_data?.Attendee
							.AttendeeId !== attendeeId &&
						dropped
					) {
						// if (!toast.isActive(toastIdsConstant.patientConnectionDropped)) {
						// 	toastIdsConstant.patientConnectionDropped = toast.error(
						// 		`Reconnecting, There is a poor internet connection...`,
						// 		{
						// 			toastId: toastIdsConstant.patientConnectionDropped,
						// 			className: "toast-warn",
						// 			preventDuplicates: true,
						// 			preventOpenDuplicates: true,
						// 		}
						// 	);
						// }
						setLeaveMettingDueToPatientUnavailability(true);
						return;
					}

					if (
						meetingApiData?.chime_meeting_data?.Attendee
							.AttendeeId &&
						attendeeId &&
						meetingApiData?.chime_meeting_data?.Attendee
							.AttendeeId !== attendeeId &&
						present
					) {
						setLeaveMettingDueToPatientUnavailability(false);
						return;
					}
					if (
						meetingApiData?.chime_meeting_data?.Attendee
							.AttendeeId &&
						attendeeId &&
						meetingApiData?.chime_meeting_data?.Attendee
							.AttendeeId !== attendeeId &&
						!present
					) {
						if (!toast.isActive(toastIdsConstant.patientLeftMeeting)) {
							setShowDialogCustomerCutTheCall(true);
							return;
						}
					}
					audioVideo?.realtimeSubscribeToReceiveDataMessage(
						DATA_MESSAGE_TOPIC,
						(msg) => videoResumeAndPause(msg)
					);
				}
			);
		}
	}, [audioVideo]);

	useEffect(() => {
		if (leaveMettingDueToPatientUnavailability) {
			endcallAfter30SecIfUserDontComeBack();
		}
		// patient come back after reconnecting to wifi
		if (leaveMettingDueToPatientUnavailability) {
			clearTimeout(checkIfInternetComebackIn30ec);
		}
	}, [leaveMettingDueToPatientUnavailability]);

	const handleOnlineNetwork = () => {
		clearTimeout(checkIfInternetComebackIn30ec);
		setInternetTimeout(false);
	};

	const endcallAfter30SecIfUserDontComeBack = () => {
		timeout.current = setTimeout(() => {
			handleEndCallHandler();
			setShowModalUserNotAvailable(true);
		}, 30000);
		setCheckIfPatientComebackIn30Sec(timeout.current);
	};

	const checkIfInternetComebackIn30Sec = () => {
		internetTimeoutId.current = setTimeout(() => {
			setInternetTimeout(true);
		}, 30000);
		setCheckIfInternetComebackIn30ec(internetTimeoutId.current);
	};

	// call once when for the first time 2 people joined
	const callDurationApi = () => {
		setIsCallInitiatedApiCallTakesPlace(true);
		websiteMeetingJoinedAction({
			call_initiated: 1,
			event_id: eventId ?? props?.match?.params?.id,
		});
		overallMeetingTimer.current = setInterval(() => {
			seconds++;
			setConsultationtime(seconds);
		}, 1000);
	};

	const handleEndCallHandler = async () => {
		stopRingtone();
		// clearing redux because otherwise start call push is going on behalf meetingApiData in useffect
		dispatch(resetWebsiteAppointmentDetailAction());
		dispatch(clearWebsiteChimeMeetingDataAction());
		setUserCancelTheCall(false);
		//leave meeting then routing
		await meetingManager.leave();
		socketRef?.emit(cancelCall, {
			eventId: eventId ?? props?.match?.params?.id,
			toUserId: appointmentDetailApiData?.body?.user_id,
			toUserType: 2,
		});
	};

	const checkIfUserjoinTheCall = () => {
		isUserJoinTheCall.current = setTimeout(() => {
			handleEndCallHandler();
			setShowModalUserNotAvailable(true);
		}, 120000);
	};

	const finishConsultationHandler = async () => {
		setShowFinishConsultation(false);
		await meetingManager?.leave();
		props.history.replace(
			`/my-appointments/detail/${eventId ?? props?.match?.params?.id}`
		);
	};

	const EndCallHandler = async () => {
		stopRingtone();
		// when patient call and immediately end the call
		if (
			meetingStatus === 0 ||
			meetingStatus === 2 ||
			meetingStatus === 3 ||
			meetingStatus === 4 ||
			meetingStatus === 5 ||
			meetingStatus === 6
		) {
			dispatch(resetWebsiteAppointmentDetailAction());
			dispatch(clearWebsiteChimeMeetingDataAction());
			socketRef?.emit(cancelCall, {
				eventId: eventId ?? props?.match?.params?.id,
				toUserId: appointmentDetailApiData?.body?.user_id,
				toUserType: 2,
			});
		}
		if (tiles?.length > 0 || isCallInitiatedApiCallTakesPlace) {
			setMeetingEndPopupWhenDoctorCancelCall(true);
		} else {
			// leave meeting then routing
			socketRef?.emit(cancelCall, {
				eventId: eventId ?? props?.match?.params?.id,
				toUserId: appointmentDetailApiData?.body?.user_id,
				toUserType: 2,
			});
			await meetingManager.audioVideo?.stop();
			await meetingManager.audioVideo?.stopLocalVideoTile();
			props.history.replace(
				`/my-appointments/detail/${eventId ?? props?.match?.params?.id}`
			);
		}
	};

	const cancelCallFromDoctorSideHandler = async () => {
		stopRingtone();
		// clearing redux because otherwise start call push is going on behalf meetingApiData in useffect
		clearInterval(overallMeetingTimer.current);
		dispatch(resetWebsiteAppointmentDetailAction());
		dispatch(clearWebsiteChimeMeetingDataAction());
		setMeetingEndPopupWhenDoctorCancelCall(false);
		setShowFinishConsultation(true);
		// clearInterval(apiCallInterval.current)
		seconds = 0;
		// leaveMeeting();
		await meetingManager.leave();
		socketRef?.emit(endCall, {
			eventId: eventId ?? props?.match?.params?.id,
			toUserId: appointmentDetailApiData?.body?.user_id,
			toUserType: 2,
		});
	};

	const rejoinCancelCallFromDoctorSideHandler = () => {
		setMeetingEndPopupWhenDoctorCancelCall(false);
	};

	const handleProceedCallHandler = async () => {
		// leaveMeeting().then(() => {
		await meetingManager.leave();
		appointmentDetailApiData?.body?.is_insurance == 1
			? props.history.replace("/e-claims/create-claim")
			: props.history.replace("/prescriptions");
		// });
	};
	// new code example
	const joinMeeting = async () => {
		if (props?.location?.search !== "?join=true") {
			privewVideoStop();
			playRingtone();
		}
		setIsMeetingJoin(true);
		setPrivewVideos(false);
		let joinData;
		if (
			meetingApiData &&
			meetingApiData?.chime_meeting_data
		) {
			if (props?.location?.search !== "?join=true" && socketRef) {
				socketRef?.emit(startCall, {
					eventId: eventId ?? props?.match?.params?.id,
					toUserId: appointmentDetailApiData?.body?.user_id,
					toUserType: 2,
				});
				console.log("I am inside Join Meeting, Patient");
			}
			joinData = {
				meetingInfo:
				meetingApiData?.chime_meeting_data?.Meeting,
				attendeeInfo:
				meetingApiData?.chime_meeting_data?.Attendee,
			};
		}
		// setShowProperInternetConenction(true);
		if (!toast.isActive(toastIdsConstant.ProperInternetConenction)) {
			toastIdsConstant.ProperInternetConenction = toast.warn(
				`Please make sure you have an active and stable internet connection for best audio consultation experience.`,
				{
					toastId: toastIdsConstant.ProperInternetConenction,
					className: "toast-warn",
					preventDuplicates: true,
					preventOpenDuplicates: true,
				}
			);
		}
		checkIfUserjoinTheCall();
		await meetingManager.join(joinData);

		await meetingManager.start();
	};

	const videoResumeAndPause = (msg) => {
		// console.log(
		// 	msg.text(),
		// 	"msg when attendee camera on/off before joining another attendee"
		// );
		if (msg) {
			// const indexOfTile = videoTileToDisplay?.findIndex(
			// 	(item) => item?.boundExternalUserId == msg?.senderExternalUserId
			// );
			// if (indexOfTile !== -1) {
			switch (msg.text()) {
				case "4":
					setIspatientPause(true);
					break;
				case "5":
					setIspatientPause(false);
					break;
				// case "6":
				// 	setIsPatientVideoShare(false);
				// 	break;
				// case "7":
				// 	setIsPatientVideoShare(true);
				// 	break;
			}
			// }
		}
	};

	const leaveMeeting = async () => {
		EndCallHandler();
	};

	const handleOkHandler = () => {
		clearInterval(overallMeetingTimer.current);
		setShowDialogCustomerCutTheCall(false);
		seconds = 0;
		// clearing redux because otherwise start call push is going on behalf meetingApiData inn useffect
		dispatch(resetWebsiteAppointmentDetailAction());
		dispatch(clearWebsiteChimeMeetingDataAction());
		setShowFinishConsultation(true);
	};

	const showDontNavigatepopup = () => {
		setIsUserTryingtoNavigate(true);
	};

	const playRingtone = () => {
		var playedPromise = ringtoneAudio.current.play();
		if (playedPromise) {
			playedPromise
				.catch((e) => {
					// console.log(e);
					if (e.name === "NotAllowedError" || e.name === "NotSupportedError") {
						// console.log(e.name);
					}
				})
				.then(() => {
					// console.log("playing sound !!!");
				});
		}
	};

	const stopRingtone = () => {
		if (ringtoneAudio && ringtoneAudio.current) {
			ringtoneAudio.current.pause();
			ringtoneAudio.current.currentTime = 0;
		}
	};

	return (
		<>
		{isValidated && !socketRef && <MeetingNotificationWithSocket />}
			<audio
				className={"d-none"}
				id="callMaker"
				ref={ringtoneAudio}
				controls="controls"
				preload="auto"
				src={ringtone}
				loop="loop"
				type="audio/wav"
			></audio>
			{meetingStatus === 1 && (
				<div className="overlay-navbar" onClick={showDontNavigatepopup} />
			)}
			{/* {meetingStatus === 0 && isCallInitiatedApiCallTakesPlace && <MyCustomLoader />} */}
			{leaveMettingDueToPatientUnavailability && (
				<div className="d-flex mb-20 text-center justify-center">
					<Message warning className="w-auto">
						<Message.Header>
							<Icon name="warning sign" /> Reconnecting, There is a poor
							internet connection...
						</Message.Header>
					</Message>
				</div>
			)}
			<div className="center_section">
				<div className="video_tile_grid">
					{privewVideos && (
						<div
							className={`privewVideo_screen ${
								!cameraOn ? "privewVideo_screen_background" : ""
							} ${!videoBlock ? "privewVideo_screen_background" : ""}`}
						>
							<video ref={videoElement}></video>
							{!cameraOn && appointmentDetailApiData?.body?.user_name && (
								<div className="privewVideo_screen_inner_div">
									<div className="mt-20 text-center w-100">
										<div style={{ color: "white" }}>
											You turned off the camera
										</div>
									</div>
								</div>
							)}
							{!videoBlock && appointmentDetailApiData?.body?.user_name && (
								<div className="privewVideo_screen_inner_div">
									<div className="mt-20 text-center w-100">
										<h3 style={{ color: "white", padding: "0 5px" }}>
											Your camera is blocked, For proper video consultation we
											need access to your camera. click the camera blocked icon
											in your's browsers address bar and refresh the page.
										</h3>
									</div>
								</div>
							)}
						</div>
					)}
					{!privewVideos && (
						<VideoTileGrid
							noRemoteVideoView={
								<div>
									{props?.location?.search !== "?join=true" &&
										appointmentDetailApiData?.body?.user_name &&
										meetingStatus === 0 && (
											<div className="mt-10 text-center w-100">
												<div className="ui medium header">
													Calling to {appointmentDetailApiData?.body?.user_name}
												</div>
											</div>
										)}
									{appointmentDetailApiData?.body?.user_name &&
										meetingStatus === 1 &&
										tiles.length === 0 &&
										!isCallInitiatedApiCallTakesPlace && (
											<div className="mt-10 text-center w-100">
												<div className="ui medium header">
													Calling to {appointmentDetailApiData?.body?.user_name}
												</div>
												{appointmentDetailApiData?.body?.user_avatar ? (
													<img
														src={
															process.env.URL +
															appointmentDetailApiData?.body?.user_avatar
														}
														alt={appointmentDetailApiData?.body?.user_name}
														className="user-video-img"
													/>
												) : (
													<img
														src={ErrorImage}
														alt={appointmentDetailApiData?.body?.user_name}
														className="user-video-img"
													/>
												)}
											</div>
										)}
									{!videoEnabled &&
										meetingStatus === 1 &&
										isCallInitiatedApiCallTakesPlace && (
											<div className="mt-10 text-center w-100">
												<div className="ui medium header">
													{appointmentDetailApiData?.body?.user_name} turned off
													the camera
												</div>
												{appointmentDetailApiData?.body?.user_avatar ? (
													<img
														src={
															process.env.URL +
															appointmentDetailApiData?.body?.user_avatar
														}
														alt={appointmentDetailApiData?.body?.user_name}
														className="user-video-img"
													/>
												) : (
													<img
														src={ErrorImage}
														alt={appointmentDetailApiData?.body?.user_name}
														className="user-video-img"
													/>
												)}
											</div>
										)}
								</div>
							}
						/>
					)}
				</div>
				<div className="meeting_roster_div">
					<MeetingRoster />
				</div>
				<div className="controls_btn_div">
					<div className="btn_div">
						{(meetingStatus === 0 ||
							meetingStatus === 2 ||
							meetingStatus === 3 ||
							meetingStatus === 4 ||
							meetingStatus === 5 ||
							meetingStatus === 6) && (
							<>
							{props?.location?.search !== "?join=true" &&
								<button
									disabled={
										!socketRef ||
										(!audioBlock || !videoBlock) ||
										!meetingApiData ||
										isEventLoading ||
										meetingStatus === 1 ||
										isApiLoading ||
										isApiLoadingToCheckEligibility ||
										!canJoinCall(appointmentDetailApiData?.body?.from_date) ||
										!canWeShowStartConsultationBtn(
											appointmentDetailApiData?.body?.status,
											appointmentDetailApiData?.body?.is_online
										)
									}
									onClick={joinMeeting}
									className="btn btn-primary small"
								>
									{printDifference(
										appointmentDetailApiData?.body?.to_date,
										appointmentDetailApiData?.body?.from_date
									)}{" "}
									&nbsp;&nbsp;
									<Icon aria-label="Start call" name="call" />
								</button>
							}
							</>
						)}
						{meetingStatus === 1 && (
							<>
								<button
									onClick={leaveMeeting}
									className="btn  btn-delete small"
								>
									End Call &nbsp;&nbsp;
									<Icon aria-label="End call" name="tty" />
								</button>
							</>
						)}
					</div>
					{privewVideos && (
						<div style={{ display: "flex" }}>
							<div className="single-option">
								{audioBlock ? (
									!audioMuted ? (
										<img
											src={audioOffImg}
											title="Unmute"
											onClick={() => {
												setAudioMuted(!audioMuted);
											}}
										/>
									) : (
										<img
											src={audioOnImg}
											title="Mute"
											onClick={() => {
												setAudioMuted(!audioMuted);
											}}
										/>
									)
								) : !audioBlock ? (
									<img
										src={audioOffImg}
										title="Unmute"
										// onClick={() => {
										// 	setAudioMuted(!audioMuted);
										// }}
									/>
								) : (
									<img
										src={audioOnImg}
										title="Mute"
										// onClick={() => {
										// 	setAudioMuted(!audioMuted);
										// }}
									/>
								)}
							</div>
							<div className="single-option">
								{videoBlock ? (
									!cameraOn ? (
										<img
											src={videoOffImg}
											onClick={() => {
												setCameraOn(!cameraOn);
												previewVideo();
											}}
											title="Turn video on"
										/>
									) : (
										<img
											src={videoOnImg}
											onClick={() => {
												setCameraOn(!cameraOn);
												privewVideoStop();
											}}
											title="Turn video off"
										/>
									)
								) : !videoBlock ? (
									<img
										src={videoOffImg}
										// onClick={() => {
										// 	setCameraOn(!cameraOn);
										// 	previewVideo();
										// }}
										title="Turn video on"
									/>
								) : (
									<img
										src={videoOnImg}
										// onClick={() => {
										// 	setCameraOn(!cameraOn);
										// 	privewVideoStop();
										// }}
										title="Turn video off"
									/>
								)}
							</div>
						</div>
					)}
					{meetingStatus === 1 && (
						<div>
							<MeetingControls />
						</div>
					)}
				</div>
			</div>
			{/* {showProperInternetConenction && (
				<ProperInternetConenction
					onHide={() => setShowProperInternetConenction(false)}
				/>
			)} */}
			{showModalUserNotAvailable && (
				<UserIsNotOnlineForCall
					name={appointmentDetailApiData?.body?.user_name}
					onHide={() => {
						setShowModalUserNotAvailable(false);
						props.history.replace(
							`/my-appointments/detail/${eventId ?? props?.match?.params?.id}`
						);
					}}
				/>
			)}
			{userCancelTheCall && (
				<UserNotAvailableForCall
					name={appointmentDetailApiData?.body?.user_name}
					onHide={() => {
						handleEndCallHandler();
						props.history.replace(
							`/my-appointments/detail/${eventId ?? props?.match?.params?.id}`
						);
					}}
				/>
			)}
			{showFinishConsultation && (
				<MeeetingDuration
					finishConsultation={finishConsultationHandler}
					duration={SecondsToHMSConvertor(consultationtime)}
				/>
			)}
			{meetingEndPopupWhenDoctorCancelCall && (
				<DoctorCancelMeeting
					cancelCallFromDoctorSide={cancelCallFromDoctorSideHandler}
					rejoinCancelCallFromDoctorSide={rejoinCancelCallFromDoctorSideHandler}
					role={4}
					history={props.history}
					isInsurance={appointmentDetailApiData?.body?.is_insurance}
					claimAndPrescriptionHandler={handleProceedCallHandler}
				/>
			)}
			{showDialogCustomerCutTheCall && (
				<CallEndByPatient
					handleOk={handleOkHandler}
					patientName={appointmentDetailApiData?.body?.user_name}
				/>
			)}
			{isUserTryingtoNavigate && (
				<UserTryingtoNavigate onHide={() => setIsUserTryingtoNavigate(false)} />
			)}
			{/* {console.log(
				"tiless",
				tiles,
				"status",
				meetingStatus
				// "userCancelTheCall",
				// userCancelTheCall
				// "audioMuted",
				// audioMuted,
				// "deviceController",
				// deviceController
				// "isVideoEnabled",
				// isVideoEnabled,
				// "attndeeId",
				// attndeeId,
				// "videoEnabled",
				// videoEnabled,
				// "cameraOn",
				// cameraOn,
				// "appointmentDetailApiData",
				// appointmentDetailApiData,
				// "videoBlock",
				// videoBlock,
				// "audioBlock",
				// audioBlock
			)} */}
		</>
	);
}

export default HospitalWebsiteLayout(Chime);
