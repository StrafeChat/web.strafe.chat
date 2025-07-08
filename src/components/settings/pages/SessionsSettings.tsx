import { Component, createSignal, For, onMount } from "solid-js";
import { useAuth } from "../../../lib/providers/auth/AuthProvider";
import { useTransContext } from "@mbarzda/solid-i18next";
import { api } from "../../../lib/api";
import { formatDistanceToNow } from "date-fns";
import { useToast } from "../../common/Toast";
import Monitor from "../../shared/icons/Monitor";

type Session = {
  token: string;
  user_id: string;
  ip: string;
  user_agent: string;
  trusted: boolean;
  created_at: string;
  expires_at: string;
  current: boolean;
};

const SessionsSettings: Component = () => {
  const { isMobile } = useAuth();
  const [t] = useTransContext();
  const { showToast } = useToast();
  const [sessions, setSessions] = createSignal<Session[]>([]);
  const [loading, setLoading] = createSignal(true);

  const fetchSessions = async () => {
    try {
      setLoading(true);
      const response = await api.sessions.list();
      setSessions(response.sessions);
    } catch (error) {
      console.error("Failed to fetch sessions:", error);
      showToast(
        t("settings.sessions.error.fetchFailed"),
        "error"
      );
    } finally {
      setLoading(false);
    }
  };

  const handleLogoutSession = async (token: string) => {
    try {
      await api.sessions.revoke(token);
      showToast(
        t("settings.sessions.success.loggedOut"),
        "success"
      );
      // Refresh the sessions list
      fetchSessions();
    } catch (error) {
      console.error("Failed to logout session:", error);
      showToast(
        t("settings.sessions.error.logoutFailed"),
        "error"
      );
    }
  };

  const getBrowserIcon = (userAgent: string) => {
    const ua = userAgent.toLowerCase();
    if (ua.includes("chrome")) {
      return (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <circle cx="12" cy="12" r="10"></circle>
          <circle cx="12" cy="12" r="4"></circle>
          <line x1="21.17" y1="8" x2="12" y2="8"></line>
          <line x1="3.95" y1="6.06" x2="8.54" y2="14"></line>
          <line x1="10.88" y1="21.94" x2="15.46" y2="14"></line>
        </svg>
      );
    } else if (ua.includes("firefox")) {
      return (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <circle cx="12" cy="12" r="10"></circle>
          <circle cx="12" cy="12" r="4"></circle>
        </svg>
      );
    } else if (ua.includes("safari")) {
      return (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="2" y1="12" x2="22" y2="12"></line>
          <line x1="12" y1="2" x2="12" y2="22"></line>
        </svg>
      );
    } else if (ua.includes("edge")) {
      return (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path>
          <path d="M3 3v5h5"></path>
        </svg>
      );
    } else {
      return (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="2" y1="12" x2="22" y2="12"></line>
          <line x1="12" y1="2" x2="12" y2="22"></line>
        </svg>
      );
    }
  };

  const getDeviceType = (userAgent: string) => {
    const ua = userAgent.toLowerCase();
    if (ua.includes("android")) {
      return t("settings.sessions.device.android");
    } else if (ua.includes("iphone") || ua.includes("ipad")) {
      return t("settings.sessions.device.ios");
    } else if (ua.includes("windows")) {
      return t("settings.sessions.device.windows");
    } else if (ua.includes("mac")) {
      return t("settings.sessions.device.mac");
    } else if (ua.includes("linux")) {
      return t("settings.sessions.device.linux");
    } else {
      return t("settings.sessions.device.unknown");
    }
  };

  const getBrowserName = (userAgent: string) => {
    const ua = userAgent.toLowerCase();
    if (ua.includes("chrome")) {
      return "Chrome";
    } else if (ua.includes("firefox")) {
      return "Firefox";
    } else if (ua.includes("safari") && !ua.includes("chrome")) {
      return "Safari";
    } else if (ua.includes("edge")) {
      return "Edge";
    } else if (ua.includes("opera")) {
      return "Opera";
    } else {
      return t("settings.sessions.browser.unknown");
    }
  };

  const handleLogoutAllSessions = async () => {
    try {
      await api.sessions.revokeAll();
      showToast(
        t("settings.sessions.success.loggedOutAll"),
        "success"
      );
      // Refresh the sessions list
      fetchSessions();
    } catch (error) {
      console.error("Failed to logout all sessions:", error);
      showToast(
        t("settings.sessions.error.logoutAllFailed"),
        "error"
      );
    }
  };

  onMount(() => {
    fetchSessions();
  });

  return (
    <div class={`mb-8 ${isMobile() ? "px-4" : "mr-5"}`}>
      {/* Header with Icon */}
      <div class="flex items-center gap-3 mb-6">
        <div class="p-3 bg-primary/10 rounded-lg">
          <Monitor />
        </div>
        <div class="flex-1">
          <h2 class="text-xl font-semibold text-text-primary mb-1">
            {t("settings.sessions.title")}
          </h2>
          <p class="text-text-secondary text-xs">
            {t("settings.sessions.description")}
          </p>
        </div>
        {sessions().length > 1 && (
          <button
            onClick={handleLogoutAllSessions}
            class="px-4 py-2 text-sm bg-red-500 hover:bg-red-600 text-white rounded-md transition-colors flex items-center space-x-2 ml-auto"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            <span>{t("settings.sessions.logoutOthers")}</span>
          </button>
        )}
      </div>

      {loading() ? (
        <div class="flex justify-center items-center py-8">
          <div class="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
        </div>
      ) : (
        <div class="space-y-4">
          {/* Current Session */}
          <For each={sessions().filter(session => session.current)}>
            {(session) => (
              <div class="bg-background1 rounded-lg p-4 transition-colors duration-200 border-2 border-primary overflow-hidden">
                <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 sm:gap-0">
                  <div class="flex items-start space-x-4">
                    <div class="p-2 bg-background2 rounded-lg">{getBrowserIcon(session.user_agent)}</div>
                    <div>
                      <div class="flex items-center space-x-2 mb-1">
                        <h3 class="text-md font-medium text-text-primary">
                          {getBrowserName(session.user_agent)}
                        </h3>
                        {session.current && (
                          <span class="px-2 py-0.5 text-xs bg-primary text-white rounded-full flex items-center">
                            <div class="w-2 h-2 bg-green-400 rounded-full mr-1"></div>
                            {t("settings.sessions.current")}
                          </span>
                        )}
                        {session.trusted && (
                          <span class="px-2 py-0.5 text-xs bg-yellow-500 text-white rounded-full">
                            {t("settings.sessions.trusted")}
                          </span>
                        )}
                      </div>
                      <p class="text-text-secondary text-sm flex items-center">
                        <svg class="w-4 h-4 mr-1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                          <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
                          <line x1="8" y1="21" x2="16" y2="21"></line>
                          <line x1="12" y1="17" x2="12" y2="21"></line>
                        </svg>
                        {getDeviceType(session.user_agent)}
                      </p>
                      <p class="text-text-secondary text-xs mt-2 flex items-center">
                        <svg class="w-4 h-4 mr-1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                          <circle cx="12" cy="12" r="10"></circle>
                          <polyline points="12 6 12 12 16 14"></polyline>
                        </svg>
                        {t("settings.sessions.lastActive", {
                          time: formatDistanceToNow(new Date(session.created_at), {
                            addSuffix: true,
                          }),
                        })}
                      </p>
                      <div class="text-text-secondary text-xs flex items-center mt-1">
                        <svg class="w-4 h-4 mr-1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                          <rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"></rect>
                          <line x1="7" y1="2" x2="7" y2="22"></line>
                          <line x1="17" y1="2" x2="17" y2="22"></line>
                          <line x1="2" y1="12" x2="22" y2="12"></line>
                          <line x1="2" y1="7" x2="7" y2="7"></line>
                          <line x1="2" y1="17" x2="7" y2="17"></line>
                          <line x1="17" y1="17" x2="22" y2="17"></line>
                          <line x1="17" y1="7" x2="22" y2="7"></line>
                        </svg>
                        {t("settings.sessions.ipAddress")}:{" "}
                        <span class="font-mono">
                          {hiddenIPs()[session.token] ? session.ip : session.ip.replace(/[^.]/g, '*')}
                        </span>
                        <button
                          onClick={() => toggleIPVisibility(session.token)}
                          class="ml-2 text-primary hover:text-primary-dark transition-colors"
                          title={hiddenIPs()[session.token] ? t("settings.sessions.hideIP") : t("settings.sessions.showIP")}
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            class="h-4 w-4"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="2"
                          >
                            {hiddenIPs()[session.token] ? (
                              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                            ) : (
                              <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                            )}
                          </svg>
                        </button>
                      </div>
                    </div>
                    {!session.current && (
                      <button
                        onClick={() => handleLogoutSession(session.token)}
                        class="px-4 py-2 text-sm bg-red-500 hover:bg-red-600 text-white rounded-md transition-colors flex items-center space-x-1"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                          <polyline points="16 17 21 12 16 7" />
                          <line x1="21" y1="12" x2="9" y2="12" />
                        </svg>
                        <span>{t("settings.sessions.logout")}</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}
          </For>

          {/* Separator */}
          <div class="border-t border-border my-4"></div>

          {/* Other Sessions */}
          <For each={sessions().filter(session => !session.current)}>
            {(session) => (
              <div class="bg-background1 rounded-lg p-4 transition-colors duration-200">
                <div class="flex justify-between items-center w-full">
                  <div class="flex items-start space-x-4 flex-grow">
                    <div class="p-2 bg-background2 rounded-lg">{getBrowserIcon(session.user_agent)}</div>
                    <div class="flex-grow">
                      <div class="flex items-center space-x-2 mb-1">
                        <h3 class="text-md font-medium text-text-primary">
                          {getBrowserName(session.user_agent)}
                        </h3>
                        {session.current && (
                          <span class="px-2 py-0.5 text-xs bg-primary text-white rounded-full flex items-center">
                            <div class="w-2 h-2 bg-green-400 rounded-full mr-1"></div>
                            {t("settings.sessions.current")}
                          </span>
                        )}
                        {session.trusted && (
                          <span class="px-2 py-0.5 text-xs bg-yellow-500 text-white rounded-full">
                            {t("settings.sessions.trusted")}
                          </span>
                        )}
                      </div>
                      <p class="text-text-secondary text-sm flex items-center">
                        <svg class="w-4 h-4 mr-1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                          <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
                          <line x1="8" y1="21" x2="16" y2="21"></line>
                          <line x1="12" y1="17" x2="12" y2="21"></line>
                        </svg>
                        {getDeviceType(session.user_agent)}
                      </p>
                      <p class="text-text-secondary text-xs mt-2 flex items-center">
                        <svg class="w-4 h-4 mr-1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                          <circle cx="12" cy="12" r="10"></circle>
                          <polyline points="12 6 12 12 16 14"></polyline>
                        </svg>
                        {t("settings.sessions.lastActive", {
                          time: formatDistanceToNow(new Date(session.created_at), {
                            addSuffix: true,
                          }),
                        })}
                      </p>
                      <div class="text-text-secondary text-xs flex items-center mt-1">
                        <svg class="w-4 h-4 mr-1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                          <rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"></rect>
                          <line x1="7" y1="2" x2="7" y2="22"></line>
                          <line x1="17" y1="2" x2="17" y2="22"></line>
                          <line x1="2" y1="12" x2="22" y2="12"></line>
                          <line x1="2" y1="7" x2="7" y2="7"></line>
                          <line x1="2" y1="17" x2="7" y2="17"></line>
                          <line x1="17" y1="17" x2="22" y2="17"></line>
                          <line x1="17" y1="7" x2="22" y2="7"></line>
                        </svg>
                        {t("settings.sessions.ipAddress")}:{" "}
                        <span class="font-mono">
                          {hiddenIPs()[session.token] ? session.ip : session.ip.replace(/[^.]/g, '*')}
                        </span>
                        <button
                          onClick={() => toggleIPVisibility(session.token)}
                          class="ml-2 text-primary hover:text-primary-dark transition-colors"
                          title={hiddenIPs()[session.token] ? t("settings.sessions.hideIP") : t("settings.sessions.showIP")}
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            class="h-4 w-4"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="2"
                          >
                            {hiddenIPs()[session.token] ? (
                              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                            ) : (
                              <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                            )}
                          </svg>
                        </button>
                      </div>
                    </div>
                    {!session.current && (
                      <button
                        onClick={() => handleLogoutSession(session.token)}
                        class="ml-auto px-4 py-2 text-sm bg-red-500 hover:bg-red-600 text-white rounded-md transition-colors flex items-center space-x-1"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                          <polyline points="16 17 21 12 16 7" />
                          <line x1="21" y1="12" x2="9" y2="12" />
                        </svg>
                        <span>{t("settings.sessions.logout")}</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}
          </For>
        </div>
      )}
    </div>
  );
};

export default SessionsSettings;

const [hiddenIPs, setHiddenIPs] = createSignal<{ [key: string]: boolean }>({});

const toggleIPVisibility = (token: string) => {
  setHiddenIPs(prev => ({ ...prev, [token]: !prev[token] }));
};