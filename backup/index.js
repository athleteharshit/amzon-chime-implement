import React, { useEffect, useState, useRef } from "react";
import {
	ConsoleLogger,
	DefaultDeviceController,
	LogLevel,
} from "amazon-chime-sdk-js";
import {
	VideoTileGrid,
	useMeetingManager,
	useRemoteVideoTileState,
	useMeetingStatus,
	useAttendeeStatus,
	useAudioVideo,
	useLocalVideo,
	useRosterState,
	useMeetingEvent,
	useToggleLocalMute,
} from "amazon-chime-sdk-component-library-react";
import { Icon, TextArea, Message } from "semantic-ui-react";
import ErrorImage from "../../../../assets/user_placeholder.svg";
import { useDispatch, useSelector } from "react-redux";
import DashboardLayout from "../../DashboardLayout/DashboardLayout";

import audioOffImg from "../../../../assets/calling-icons/audio-off.svg";
import audioOnImg from "../../../../assets/calling-icons/audio-on.svg";
import videoOffImg from "../../../../assets/calling-icons/video-off.svg";
import videoOnImg from "../../../../assets/calling-icons/video-on.svg";
import { getWebsiteMeetingAction } from "../../../redux/actions/WebsiteActions/websiteMeetingAction";
import "./MeetingChime.css";
import MeetingControls from "./components/meetingControls";
import MeetingRoster from "./components/MeetingRoster";
import {
	clearAppointmentDetailData,
	getAppointmentDetail,
} from "../../../redux/actions/appointmentAction";
import { roles } from "../../../utility/roleConstant";
import { getRoleIdInLS, SecondsToHMSConvertor } from "../../../utility/util";
import {
	clearChimeMeetingDataAction,
	getMeetingAction,
	meetingFinishedAction,
	meetingJoinedAction,
	saveDoctorNotesAction,
	updateMeetingTimeAction,
} from "../../../redux/actions/meetingAction";
import UserNotAvailableForCall from "../../../components/Modals/UserNotAvailableForCall";
import UserIsNotOnlineForCall from "../../../components/Modals/UserIsNotOnlineForCall";
import ProperInternetConenction from "../../../components/Modals/ProperInternetConenction/ProperInternetConenction";
import MeeetingDuration from "../../../components/Modals/MeeetingDuration/MeeetingDuration";
import DoctorCancelMeeting from "../../../components/Modals/DoctorCancelMeeting/DoctorCancelMeeting";
import ConfirmEndCall from "../../../components/Modals/ConfirmCallEnding/ConfirmCallEnding";
import CallEndByPatient from "../../../components/Modals/CallEndByPatient/CallEndByPatient";
import { cancelCall, startCall } from "../../../utility/socketConstant";
import UserTryingtoNavigate from "../../../components/WebsiteComponents/WebsiteModals/UserTryingtoNavigate";
import { toast } from "react-toastify";
import { toastIdsConstant } from "../../../utility/toastIdsConstant";
import {
	canJoinCall,
	printDifference,
} from "../../../utility/appointmentConstant";
import { canWeShowStartConsultationBtn } from "../../../utility/websiteConstant/appointmentConstant";
import ImageViewerPatient from "../../Myprofile/common/ImageVIewerPatient";
import { DATA_MESSAGE_TOPIC } from "../../../utility/meetingConstant";
import ringtone from "../../../../assets/ringtones/calling.wav";
import MyCustomLoader from "../../../components/MyCustomLoader/MyCustomLoader";

// Currently in Use for Doctor #VideoCall

function MeetingChime(props) {
	const dispatch = useDispatch();
	const ringtoneAudioDoctor = useRef(null);
	let audioVideo = useAudioVideo();
	const { isVideoEnabled, toggleVideo } = useLocalVideo();
	const { toggleMute } = useToggleLocalMute();
	const [onlyOnce, setOnlyOnce] = useState(false);
	const [onlyOnceAudio, setOnlyOnceAudio] = useState(false);
	const role = getRoleIdInLS();
	const { apiData } = useSelector((state) => state?.appointmentDetail);
	let seconds = 0;
	const { tiles } = useRemoteVideoTileState();
	// const { isUserActive } = useUserActivityState();
	const meetingStatus = useMeetingStatus();
	const { roster } = useRosterState();
	const meetingEvent = useMeetingEvent();
	const meetingManager = useMeetingManager();
	const [attndeeId, setAttndeeId] = useState("");
	const [privewVideos, setPrivewVideos] = useState(true);
	const [cameraOn, setCameraOn] = useState(true);
	const [audioMuted, setAudioMuted] = useState(true);
	const { videoEnabled } = useAttendeeStatus(attndeeId || "");
	const { isDoctorNoteSaveApiLoading } = useSelector((state) => state?.meeting);
	const [checkIfPatientComebackIn30Sec, setCheckIfPatientComebackIn30Sec] =
		useState(null);
	const [
		isCallInitiatedApiCallTakesPlace,
		setIsCallInitiatedApiCallTakesPlace,
	] = useState(false);
	const [consultationtime, setConsultationtime] = useState(0);
	const [userCancelTheCall, setUserCancelTheCall] = useState(false);
	const [doctorNotes, setDoctorNotes] = useState(
		apiData?.body?.doctor_note_on_appointment ?? ""
	);
	const [
		meetingEndPopupWhenDoctorCancelCall,
		setMeetingEndPopupWhenDoctorCancelCall,
	] = useState(false);
	const [showDialogCustomerCutTheCall, setShowDialogCustomerCutTheCall] =
		useState(false);
	const [showFinishConsultation, setShowFinishConsultation] = useState(false);
	const [showModalUserNotAvailable, setShowModalUserNotAvailable] =
		useState(false);
	const [showProperInternetConenction, setShowProperInternetConenction] =
		useState(false);
	const [confirmCallEnding, setConfirmCallEnding] = useState(false);
	const apiCallInterval = useRef();
	const overallMeetingTimer = useRef();
	const isUserJoinTheCall = useRef();
	const timeout = useRef();
	const { socketRef } = useSelector((state) => state?.socket);
	const [isUserTryingtoNavigate, setIsUserTryingtoNavigate] = useState(false);
	const [
		leaveMettingDueToPatientUnavailability,
		setLeaveMettingDueToPatientUnavailability,
	] = useState(false);
	const [internetTimeout, setInternetTimeout] = useState(false);
	const [checkIfInternetComebackIn30ec, setCheckIfInternetComebackIn30ec] =
		useState(null);
	const [ispatientPause, setIspatientPause] = useState(false);
	const [isMeetinigJoin, setIsMeetingJoin] = useState(false);
	const [videoBlock, setVideoBlock] = useState(false);
	const [audioBlock, setAudioBlock] = useState(false);
	const internetTimeoutId = useRef();
	const videoElement = useRef();
	let attendees = Object.values(roster);

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
				if (
					!(
						meetingEvent &&
						meetingEvent?.attributes?.attendeeId === chimeAttendeeId
					)
				) {
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

		return async () => {
			clearInterval(onlineInterval);
			clearInterval(apiCallInterval.current);
			clearTimeout(checkIfPatientComebackIn30Sec);
			dispatch(clearAppointmentDetailData());
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

	// useEffect(() => {
	// 	if (props?.match?.params?.id) {
	// 		dispatch(getMeetingAction(props?.match?.params?.id));
	// 	}
	// }, [props?.match?.params?.id]);

	useEffect(() => {
		// when user join meeting from push notification
		if (
			props.location.search == "?join=true" &&
			apiData &&
			!isMeetinigJoin &&
			!isCallInitiatedApiCallTakesPlace
		) {
			joinMeeting();
		}
	}, [
		props.location.search,
		apiData,
		isMeetinigJoin,
		isCallInitiatedApiCallTakesPlace,
	]);

	// useEffect(() => {
	// 	if (!apiData) {
	// 		if (props?.match?.params?.id && roles.DOCTOR == 8) {
	// 			dispatch(getAppointmentDetail(props?.match?.params?.id));
	// 		}
	// 	}
	// }, [apiData]);

	useEffect(() => {
		if (props?.match?.params?.id && roles.DOCTOR == 8) {
			dispatch(getAppointmentDetail(props?.match?.params?.id));
		}
	}, []);

	useEffect(() => {
		if (tiles?.length > 0 && !isCallInitiatedApiCallTakesPlace) {
			clearInterval(isUserJoinTheCall.current);
			callDurationApi();
		}
		// when pateint end the call
		if (
			tiles?.length == 0 &&
			isCallInitiatedApiCallTakesPlace &&
			meetingStatus == 1 &&
			!leaveMettingDueToPatientUnavailability
		) {
			clearInterval(isUserJoinTheCall.current);
			// setShowDialogCustomerCutTheCall(true);
		}
	}, [
		tiles,
		isCallInitiatedApiCallTakesPlace,
		meetingStatus,
		leaveMettingDueToPatientUnavailability,
	]);

	// useEffect(() => {
	// 	if (meetingApiData && !isMeetinigJoin) {
	// 		joinMeeting();
	// 		console.log("one");
	// 	}
	// }, [meetingApiData, isMeetinigJoin]);

	useEffect(() => {
		if (socketRef) {
			socketRef.on(cancelCall, (res) => {
				// endCallWhenUserNotThere();
				setUserCancelTheCall(true);
			});
		}
	}, [socketRef]);

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
						apiData?.body?.chime_meeting_data?.Attendee.AttendeeId &&
						attendeeId &&
						apiData?.body?.chime_meeting_data?.Attendee.AttendeeId !==
							attendeeId &&
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
						apiData?.body?.chime_meeting_data?.Attendee.AttendeeId &&
						attendeeId &&
						apiData?.body?.chime_meeting_data?.Attendee.AttendeeId !==
							attendeeId &&
						present
					) {
						setLeaveMettingDueToPatientUnavailability(false);
						return;
					}
					if (
						apiData?.body?.chime_meeting_data?.Attendee.AttendeeId &&
						attendeeId &&
						apiData?.body?.chime_meeting_data?.Attendee.AttendeeId !==
							attendeeId &&
						!present
					) {
						if (!toast.isActive(toastIdsConstant.patientLeftMeeting)) {
							setShowDialogCustomerCutTheCall(true);
							clearInterval(overallMeetingTimer.current);
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

	useEffect(() => {
		if (apiData?.body?.doctor_note_on_appointment) {
			setDoctorNotes(apiData?.body?.doctor_note_on_appointment);
		}
	}, [apiData?.body?.doctor_note_on_appointment]);

	const handleOnlineNetwork = () => {
		clearTimeout(checkIfInternetComebackIn30ec);
		setInternetTimeout(false);
	};

	const endcallAfter30SecIfUserDontComeBack = () => {
		timeout.current = setTimeout(() => {
			// endCallWhenUserNotThere();
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

	const videoResumeAndPause = (msg) => {
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

	const callDurationApi = () => {
		if (role == 8) {
			setIsCallInitiatedApiCallTakesPlace(true);
			meetingJoinedAction({
				call_initiated: 1,
				event_id: props?.match?.params?.id,
			});
		}
		if (role == 8) {
			// this seconds have total metting converstation time from start to left meeting
			overallMeetingTimer.current = setInterval(() => {
				seconds++;
				setConsultationtime(seconds);
			}, 1000);
			apiCallInterval.current = setInterval(() => {
				// update server with api call
				const payload = {
					call_duration: 10,
					event_id: props?.match?.params?.id,
				};
				navigator.onLine && updateMeetingTimeAction(payload);
			}, 10000);
		}
	};

	const joinMeeting = async () => {
		if (props.location.search !== "?join=true") {
			privewVideoStop();
			playRingtone();
		}
		setIsMeetingJoin(true);
		setPrivewVideos(false);
		let joinData;
		if (apiData && apiData?.body?.chime_meeting_data) {
			if (props.location.search !== "?join=true") {
				socketRef?.emit(startCall, {
					eventId: props?.match?.params?.id,
					toUserId: apiData?.body?.user_id,
					toUserType: 1,
				});
			}
			joinData = {
				meetingInfo: apiData?.body?.chime_meeting_data?.Meeting,
				attendeeInfo: apiData?.body?.chime_meeting_data?.Attendee,
			};
		}
		// setShowProperInternetConenction(true);
		if (!toast.isActive(toastIdsConstant.ProperInternetConenction)) {
			toastIdsConstant.ProperInternetConenction = toast.warn(
				`Please make sure you have an active and stable internet connection for best video consultation experience.`,
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

	const checkIfUserjoinTheCall = () => {
		isUserJoinTheCall.current = setTimeout(() => {
			// endCallWhenUserNotThere();
			setShowModalUserNotAvailable(true);
		}, 120000);
	};

	const endCallWhenUserNotThere = () => {
		// stopRingtone();
		setConfirmCallEnding(false);
		setUserCancelTheCall(false);

		setShowModalUserNotAvailable(false);
		dispatch(clearAppointmentDetailData());
		dispatch(clearChimeMeetingDataAction());
		socketRef?.emit(cancelCall, {
			eventId: props?.match?.params?.id,
			toUserId: apiData?.body?.user_id,
			toUserType: 1,
		});
		props.history.replace(
			`/appointments/appointment-detail/${props?.match?.params?.id}`
		);
	};

	useEffect(() => {
		if (userCancelTheCall) {
			stopRingtone();
		}
	}, [userCancelTheCall]);

	const cancelCallFromDoctorSideHandler = async () => {
		setShowFinishConsultation(true);
		clearInterval(overallMeetingTimer.current);
		clearInterval(apiCallInterval.current);
		seconds = 0;
		if (role == 8) {
			meetingFinishedAction({
				call_finished: 1,
				event_id: props?.match?.params?.id,
				call_duration: consultationtime % 10,
			});
		}
		await meetingManager.leave();
	};

	const rejoinCancelCallFromDoctorSideHandler = () => {
		setMeetingEndPopupWhenDoctorCancelCall(false);
	};

	const handleProceedCallHandler = async () => {
		if (role == 8) {
			meetingFinishedAction({
				call_finished: 1,
				event_id: props?.match?.params?.id,
				call_duration: consultationtime % 10,
			});
		}
		await meetingManager.leave();
		dispatch(clearAppointmentDetailData());
		dispatch(clearChimeMeetingDataAction());
		// apiData?.body?.is_insurance == 1
		// 	? props.history.replace(
		// 			`/e-claims/appointment/${props?.match?.params?.id}`
		// 	  )
		// 	: props.history.replace(
		// 			`/appointment/prescription/create/${props?.match?.params?.id}`
		// 	  );
		apiData?.body?.is_insurance == 1
			? apiData?.body?.claim_or_rx_done == 1
				? props.history?.replace(`/e-claims/detail/${apiData?.body?.claim_id}`)
				: props.history?.replace(
						`/e-claims/appointment/${props?.match?.params?.id}`
				  )
			: apiData?.body?.claim_or_rx_done == 1 &&
			  apiData?.body?.call_finished == 1
			? props.history?.replace(
					`/prescriptions/detail/${apiData?.body?.order_id}`
			  )
			: props.history?.replace(
					`/appointment/prescription/create/${props?.match?.params?.id}`
			  );
	};

	const handleEndCallHandlerFromDoctor = async () => {
		if (role == 8) {
			meetingFinishedAction({
				call_finished: 1,
				event_id: props?.match?.params?.id,
				call_duration: consultationtime % 10,
			});
		}
		seconds = 0;
		clearInterval(overallMeetingTimer.current);
		setConfirmCallEnding(false);
		await meetingManager.leave();
		dispatch(clearAppointmentDetailData());
		dispatch(clearChimeMeetingDataAction());
		setShowFinishConsultation(true);
		// props.history.replace(
		// 	`/appointments/appointment-detail/${props?.match?.params?.id}`
		// );
	};

	const handleOkHandler = () => {
		setShowDialogCustomerCutTheCall(false);
		setConfirmCallEnding(true);
		clearInterval(overallMeetingTimer.current);
		seconds = 0;
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
			// in order to avoid start call push bcz useefect have join meeting function if we have meeting data in redux
			dispatch(clearAppointmentDetailData());
			dispatch(clearChimeMeetingDataAction());
			socketRef?.emit(cancelCall, {
				eventId: props?.match?.params?.id,
				toUserId: apiData?.body?.user_id,
				toUserType: 1,
			});
		}
		if (tiles?.length > 0 || isCallInitiatedApiCallTakesPlace) {
			setMeetingEndPopupWhenDoctorCancelCall(true);
		} else {
			// leave meeting then routing
			socketRef?.emit(cancelCall, {
				eventId: props?.match?.params?.id,
				toUserId: apiData?.body?.user_id,
				toUserType: 1,
			});
			await meetingManager.audioVideo?.stop();
			await meetingManager.audioVideo?.stopLocalVideoTile();
			props.history.replace(
				`/appointments/appointment-detail/${props?.match?.params?.id}`
			);
		}
	};

	const showDontNavigatepopup = () => {
		setIsUserTryingtoNavigate(true);
	};

	const finishConsultationHandler = async () => {
		setShowFinishConsultation(false);
		await meetingManager.leave();
		props.history.replace(
			`/appointments/appointment-detail/${props?.match?.params?.id}`
		);
	};

	const handleEndCallHandler = async () => {
		setConfirmCallEnding(false);
		await meetingManager.leave();
		props.history.replace(
			`/appointments/appointment-detail/${props?.match?.params?.id}`
		);
	};

	const saveNoteHandler = () => {
		const payload = {
			doctor_note: doctorNotes,
			event_id: props?.match?.params?.id,
		};
		if (doctorNotes.length > 0) dispatch(saveDoctorNotesAction(payload));
	};

	const playRingtone = () => {
		var playedPromise = ringtoneAudioDoctor.current.play();
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
		if (ringtoneAudioDoctor && ringtoneAudioDoctor.current) {
			ringtoneAudioDoctor.current.pause();
			ringtoneAudioDoctor.current.currentTime = 0;
		}
	};

	return (
		<>
			<audio
				className={"d-none"}
				id="callMaker"
				ref={ringtoneAudioDoctor}
				controls="controls"
				preload="auto"
				src={ringtone}
				loop="loop"
				type="audio/wav"
			></audio>
			{meetingStatus == 1 && (
				<div
					className="overlay-navbar-portal"
					onClick={showDontNavigatepopup}
				/>
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
					{/* {showPrivewVideo ? (
						<>
							{privewVideo && <PreviewVideo style={{ height: "100%" }} />}
							<LocalVideo style={{ height: "100%" }} />
						</>
					) : ( */}
					{privewVideos && (
						<div
							className={`privewVideo_screen ${
								!cameraOn ? "privewVideo_screen_background" : ""
							} ${!videoBlock ? "privewVideo_screen_background" : ""}`}
						>
							<video ref={videoElement}></video>
							{!cameraOn && apiData?.body?.user_name && (
								<div className="privewVideo_screen_inner_div">
									<div className="mt-20 text-center w-100">
										<div style={{ color: "white" }}>
											You turned off the camera
										</div>
									</div>
								</div>
							)}
							{!videoBlock && apiData?.body?.user_name && (
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
										apiData?.body?.user_name &&
										meetingStatus === 0 && (
											<div className="mt-10 text-center w-100">
												<div className="ui medium header">
													Calling to {apiData?.body?.user_name}
												</div>
											</div>
										)}
									{apiData?.body?.user_name &&
										meetingStatus === 1 &&
										tiles.length === 0 &&
										!isCallInitiatedApiCallTakesPlace && (
											<div className="mt-10 text-center w-100">
												<div className="ui medium header">
													Calling to {apiData?.body?.user_name}
												</div>
												{apiData?.body?.user_avatar ? (
													<img
														src={process.env.URL + apiData?.body?.user_avatar}
														alt={apiData?.body?.user_name}
														className="user-video-img"
													/>
												) : (
													<img
														src={ErrorImage}
														alt={apiData?.body?.user_name}
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
													{apiData?.body?.user_name} turned off the camera
												</div>
												{apiData?.body?.user_avatar ? (
													<img
														src={process.env.URL + apiData?.body?.user_avatar}
														alt={apiData?.body?.user_name}
														className="user-video-img"
													/>
												) : (
													<img
														src={ErrorImage}
														alt={apiData?.body?.user_name}
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
								{props?.location?.search !== "?join=true" && (
									<button
										disabled={
											!audioBlock ||
											!videoBlock ||
											!apiData ||
											meetingStatus === 1 ||
											!canJoinCall(apiData?.body?.from_date) ||
											!canWeShowStartConsultationBtn(
												apiData?.body?.status,
												apiData?.body?.is_online
											)
										}
										className="btn btn-primary mb-20 small"
										onClick={joinMeeting}
									>
										{printDifference(
											apiData?.body?.to_date,
											apiData?.body?.from_date
										)}
									</button>
								)}
							</>
						)}
						{meetingStatus === 1 && (
							<button
								onClick={EndCallHandler}
								className="btn  btn-delete small"
							>
								End Call &nbsp;&nbsp;
								<Icon aria-label="End call" name="tty" />
							</button>
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
				{meetingStatus === 1 && (
					<div className="doctor-notes">
						<TextArea
							placeholder="Enter your notes..."
							value={doctorNotes}
							onChange={(e) => setDoctorNotes(e?.target?.value)}
						/>
						<button
							disabled={isDoctorNoteSaveApiLoading}
							className="btn btn-primary small"
							onClick={saveNoteHandler}
						>
							Save
						</button>
					</div>
				)}
			</div>
			{showDialogCustomerCutTheCall && role == 8 && (
				<CallEndByPatient
					handleOk={handleOkHandler}
					patientName={apiData?.body?.user_name}
				/>
			)}
			{confirmCallEnding && role == 8 && (
				<ConfirmEndCall
					handleEndCall={handleEndCallHandlerFromDoctor}
					handleProceedCall={handleProceedCallHandler}
					isInsurance={apiData?.body?.is_insurance}
					isCallFinished={apiData?.body?.call_finished}
					isClaimRXDone={apiData?.body?.claim_or_rx_done}
					patientName={apiData?.body?.user_name}
					duration={SecondsToHMSConvertor(consultationtime)}
				/>
			)}
			{meetingEndPopupWhenDoctorCancelCall && role == 8 && (
				<DoctorCancelMeeting
					cancelCallFromDoctorSide={cancelCallFromDoctorSideHandler}
					rejoinCancelCallFromDoctorSide={rejoinCancelCallFromDoctorSideHandler}
					role={role}
					history={props.history}
					isInsurance={apiData?.body?.is_insurance}
					isCallFinished={apiData?.body?.call_finished}
					isClaimRXDone={apiData?.body?.claim_or_rx_done}
					claimAndPrescriptionHandler={handleProceedCallHandler}
				/>
			)}
			{showFinishConsultation && role == 8 && (
				<MeeetingDuration
					finishConsultation={finishConsultationHandler}
					duration={SecondsToHMSConvertor(consultationtime)}
				/>
			)}
			{/* {showProperInternetConenction && role == 8 && (
				<ProperInternetConenction
					onHide={() => setShowProperInternetConenction(false)}
				/>
			)} */}
			{showModalUserNotAvailable && role == 8 && (
				<UserIsNotOnlineForCall
					name={apiData?.body?.user_name}
					onHide={() => {
						// setShowModalUserNotAvailable(false);
						// props.history.replace(
						// 	`/appointments/appointment-detail/${props?.match?.params?.id}`
						// );
						endCallWhenUserNotThere();
					}}
				/>
			)}
			{userCancelTheCall && (
				<UserNotAvailableForCall
					name={apiData?.body?.user_name}
					onHide={() => {
						// setUserCancelTheCall(false);
						// props.history.replace(
						// 	`/appointments/appointment-detail/${props?.match?.params?.id}`
						// );
						endCallWhenUserNotThere();
					}}
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
				// "apiData",
				// apiData
				// "isVideoEnabled",
				// isVideoEnabled,
				// "attndeeId",
				// attndeeId,
				// "videoEnabled",
				// videoEnabled,
				// "cameraOn",
				// cameraOn,
				// "apiData",
				// apiData
			)} */}
		</>
	);
}

export default DashboardLayout(MeetingChime);
