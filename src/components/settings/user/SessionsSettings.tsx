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
  const [hiddenIPs, setHiddenIPs] = createSignal<{ [key: string]: boolean }>({});

  const toggleIPVisibility = (sessionToken: string) => {
    setHiddenIPs(prev => ({
      ...prev,
      [sessionToken]: !prev[sessionToken]
    }));
  };

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
    <div class={`mb-8 overflow-hidden ${isMobile() ? "" : "mr-5"}`}>
      {/* Header with Icon */}
      <div class="flex items-center gap-3 mb-6 overflow-hidden">
        <div class="p-2 bg-primary/10 rounded-lg flex-shrink-0">
          <Monitor />
        </div>
        <div class="min-w-0 flex-1">
          <h2 class="text-xl font-semibold text-text-primary mb-1 truncate">
            {t("settings.sessions.title")}
          </h2>
          <p class="text-text-secondary text-sm truncate">
            {t("settings.sessions.description")}
          </p>
        </div>
      </div>

      {loading() ? (
        <div class="flex items-center justify-center py-8">
          <div class="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent"></div>
        </div>
      ) : (
        <div class="space-y-6 overflow-hidden">
          {/* Current Session */}
          <div class="bg-background1 rounded-lg p-4 sm:p-6 overflow-hidden">
            <div class="flex items-center gap-2 mb-4 overflow-hidden">
              <div class="w-2 h-2 bg-green-500 rounded-full animate-pulse flex-shrink-0"></div>
              <h3 class="text-lg font-semibold text-text-primary truncate">Current Session</h3>
            </div>
            <For each={sessions().filter(session => session.current)}>
              {(session) => (
                <div class="p-3 sm:p-4 rounded-lg border bg-green-500/10 border-green-500/30 dark:bg-green-400/10 dark:border-green-400/30 overflow-hidden">
                  <div class="flex flex-col sm:flex-row sm:items-start gap-3 overflow-hidden">
                    <div class="flex items-start gap-3 min-w-0 flex-1 overflow-hidden">
                      <div class="p-2 bg-background2 rounded-lg flex-shrink-0">
                        {getBrowserIcon(session.user_agent)}
                      </div>
                      <div class="min-w-0 flex-1">
                        <div class="flex flex-wrap items-center gap-2 mb-1 overflow-hidden">
                          <h4 class="text-text-primary font-medium truncate break-all">
                            {getBrowserName(session.user_agent)}
                          </h4>
                          {session.trusted && (
                            <span class="px-2 py-1 text-xs bg-yellow-500 text-white rounded-full flex-shrink-0">
                              Trusted
                            </span>
                          )}
                        </div>
                        <p class="text-text-secondary text-sm mb-2 truncate break-all">
                          {getDeviceType(session.user_agent)}
                        </p>
                        <div class="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 text-xs text-text-secondary overflow-hidden">
                          <span class="truncate break-all">
                            {t("settings.sessions.lastActive", {
                              time: formatDistanceToNow(new Date(session.created_at), {
                                addSuffix: true,
                              }),
                            })}
                          </span>
                          <div class="flex items-center gap-1 min-w-0 overflow-hidden">
                            <span class="flex-shrink-0 text-xs">{t("settings.sessions.ipAddress")}:</span>
                            <span class="font-mono text-xs truncate break-all max-w-20">
                              {hiddenIPs()[session.token] ? session.ip : session.ip.replace(/[^.]/g, '*')}
                            </span>
                            <button
                              onClick={() => toggleIPVisibility(session.token)}
                              class="text-primary hover:text-primary-dark flex-shrink-0 p-1"
                              title={hiddenIPs()[session.token] ? "Hide IP" : "Show IP"}
                            >
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                class="h-3 w-3"
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
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </For>
          </div>

          {/* Other Sessions */}
          {sessions().filter(session => !session.current).length > 0 && (
            <div class="bg-background1 rounded-lg p-4 sm:p-6 overflow-hidden">
              <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4 overflow-hidden">
                <div class="flex items-center gap-2 min-w-0 overflow-hidden">
                  <div class="w-2 h-2 bg-gray-400 rounded-full flex-shrink-0"></div>
                  <h3 class="text-lg font-semibold text-text-primary truncate break-all">
                    Other Sessions ({sessions().filter(session => !session.current).length})
                  </h3>
                </div>
                <button
                  onClick={handleLogoutAllSessions}
                  class="px-3 py-1.5 text-sm bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors flex-shrink-0 w-full sm:w-auto"
                >
                  {t("settings.sessions.logoutOthers")}
                </button>
              </div>
              <div class="space-y-4 overflow-hidden">
                <For each={sessions().filter(session => !session.current)}>
                  {(session) => (
                    <div class="p-3 sm:p-4 rounded-lg border bg-background2 border-border overflow-hidden">
                      <div class="flex flex-col gap-3 overflow-hidden">
                        <div class="flex items-start gap-3 min-w-0 overflow-hidden">
                          <div class="p-2 bg-background2 rounded-lg flex-shrink-0">
                            {getBrowserIcon(session.user_agent)}
                          </div>
                          <div class="min-w-0 flex-1 overflow-hidden">
                            <div class="flex flex-wrap items-center gap-2 mb-1 overflow-hidden">
                              <h4 class="text-text-primary font-medium truncate break-all">
                                {getBrowserName(session.user_agent)}
                              </h4>
                              {session.trusted && (
                                <span class="px-2 py-1 text-xs bg-yellow-500 text-white rounded-full flex-shrink-0">
                                  Trusted
                                </span>
                              )}
                            </div>
                            <p class="text-text-secondary text-sm mb-2 truncate break-all">
                              {getDeviceType(session.user_agent)}
                            </p>
                            <div class="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 text-xs text-text-secondary overflow-hidden">
                              <span class="truncate break-all">
                                {t("settings.sessions.lastActive", {
                                  time: formatDistanceToNow(new Date(session.created_at), {
                                    addSuffix: true,
                                  }),
                                })}
                              </span>
                              <div class="flex items-center gap-1 min-w-0 overflow-hidden">
                                <span class="flex-shrink-0 text-xs">{t("settings.sessions.ipAddress")}:</span>
                                <span class="font-mono text-xs truncate break-all max-w-20">
                                  {hiddenIPs()[session.token] ? session.ip : session.ip.replace(/[^.]/g, '*')}
                                </span>
                                <button
                                  onClick={() => toggleIPVisibility(session.token)}
                                  class="text-primary hover:text-primary-dark flex-shrink-0 p-1"
                                  title={hiddenIPs()[session.token] ? "Hide IP" : "Show IP"}
                                >
                                  <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    class="h-3 w-3"
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
                          </div>
                        </div>
                        <button
                          onClick={() => handleLogoutSession(session.token)}
                          class="px-3 py-1.5 text-sm bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors w-full sm:w-auto sm:self-end"
                        >
                          {t("settings.sessions.logout")}
                        </button>
                      </div>
                    </div>
                  )}
                </For>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SessionsSettings;