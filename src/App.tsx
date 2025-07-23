import { ThemeProvider } from "./lib/providers/theme/ThemeProvider";
import { ContextMenuProvider } from "./lib/providers/context/ContextMenuProvider";
import { AuthProvider } from "./lib/providers/auth/AuthProvider";
import { CacheProvider } from "./lib/providers/cache/CacheProvider";
import { MobileNavProvider } from "./lib/providers/mobile/MobileNavProvider";
import { TransProvider } from "@mbarzda/solid-i18next";
import { Router, Route } from "@solidjs/router";
import en from "./locales/list/en-us.json";
import es from "./locales/list/es-es.json";
import fr from "./locales/list/fr-fr.json";
import ar from "./locales/list/ar-sa.json";
import { ParentProps, createEffect, Show } from "solid-js";
import { Interface } from "./components/shared/Interface";
import { getDirection } from "./lib/utils/direction";
import { applyCustomStyles } from "./lib/utils/customStyles";
import { ToastProvider } from "./components/common/Toast";
import { SettingsProvider } from "./lib/providers/settings/SettingsProvider";
import { UserSettingsProvider } from "./lib/providers/userSettings/UserSettingsProvider";
import { ModalProvider } from "./lib/providers/modal/ModalProvider";
import LinkConfirmationHandler from "./components/LinkConfirmationHandler";
import UpdateNotificationModal from "./components/modals/UpdateNotificationModal";
import { useUpdateNotification } from "./lib/hooks/useUpdateNotification";
import { useAuth } from "./lib/providers/auth/AuthProvider";
import GlobalKeyboardHandler from "./components/common/GlobalKeyboardHandler";
// Import test utilities for development
import "./lib/utils/updateTestUtils";
import EmailVerify from "./components/auth/EmailVerify";
import Login from "./components/auth/Login";
import PasswordReset from "./components/auth/PasswordReset";
import PasswordResetComplete from "./components/auth/PasswordResetComplete";
import PasswordResetVerify from "./components/auth/PasswordResetVerify";
import Register from "./components/auth/Register";
import RoomView from "./components/chat/RoomView";
import Home from "./components/home/Home";
import Friends from "./components/home/friends/Friends";
import Notes from "./components/home/notes/Notes";
import { SpaceRoomView } from "./components/spaces/SpaceRoomView";
import SpaceView from "./components/spaces/SpaceView";
import InviteHandler from "./components/invite/InviteHandler";
import { VoiceProvider } from "./lib/providers/voice/VoiceProvider";
import { NavigationHistoryProvider } from "./lib/providers/navigation/NavigationHistoryProvider";



const UpdateNotificationWrapper = () => {
	const { isAuthenticated } = useAuth();
	const {
		updateInfo,
		isModalOpen,
		handleModalClose
	} = useUpdateNotification();

	return (
		<Show when={isAuthenticated()}>
			<UpdateNotificationModal
				isOpen={isModalOpen()}
				onClose={handleModalClose}
				updateInfo={updateInfo()}
			/>
		</Show>
	);
};

const MountApp = (props: ParentProps) => {
	const savedLang = localStorage.getItem("sc_lang") || "en_us";

	createEffect(() => {
		// Set language and direction
		document.documentElement.dir = getDirection(savedLang);
		document.documentElement.lang = savedLang.split("_")[0];

		// Apply custom styles
		applyCustomStyles();
	});

	return (
		<TransProvider
			options={{
				fallbackLng: "en_us",
				lng: savedLang,
				resources: {
					en_us: { translation: en },
					es_es: { translation: es },
					fr_fr: { translation: fr },
					ar_sa: { translation: ar },
				},
			}}
		>
			<ThemeProvider>
				<ToastProvider>
					<CacheProvider>
						<UserSettingsProvider>
							<AuthProvider>
								<VoiceProvider>
									<ContextMenuProvider>
										<NavigationHistoryProvider>
											<MobileNavProvider>
												<SettingsProvider>
													<ModalProvider>
														<LinkConfirmationHandler />
														<UpdateNotificationWrapper />
														<GlobalKeyboardHandler />
														<div class="h-[100dvh] w-full overflow-hidden">{props.children}</div>
													</ModalProvider>
												</SettingsProvider>
											</MobileNavProvider>
										</NavigationHistoryProvider>
									</ContextMenuProvider>
								</VoiceProvider>
							</AuthProvider>
						</UserSettingsProvider>
					</CacheProvider>
				</ToastProvider>
			</ThemeProvider>
		</TransProvider>
	);
};

const App = () => {

	return (
		<MountApp>
			<Router>
				<Route path="/login" component={Login} />
				<Route path="/register" component={Register} />
				<Route path="/verify-email" component={EmailVerify} />
				<Route path="/password-reset" component={PasswordReset} />
				<Route path="/password-reset/verify" component={PasswordResetVerify} />
				<Route path="/password-reset/complete" component={PasswordResetComplete} />
				<Route path="/invite/:code" component={InviteHandler} />
				<Route path="/" component={Interface as never}>
					<Route path="/" component={Home} />
					<Route path="/friends" component={Friends} />
					<Route path="/notes" component={Notes} />
					<Route path="/rooms/:roomId" component={RoomView} />
					<Route path="/spaces/:spaceId" component={SpaceView} />
					<Route path="/spaces/:spaceId/rooms/:roomId" component={SpaceRoomView} />
				</Route>
			</Router>
		</MountApp>
	);
};

export default App;
