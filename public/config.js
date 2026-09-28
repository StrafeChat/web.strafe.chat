// Runtime configuration. In development this file is served as-is (empty config, so the
// app falls back to VITE_* / localhost). In the Docker image the entrypoint rewrites it
// from STRAFE_API_URL / STRAFE_STARGATE_URL so a single build works for any deployment.
window.__STRAFE_CONFIG__ = window.__STRAFE_CONFIG__ || {};
