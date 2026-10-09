//! The native shell around the Strafe web client.
//!
//! Everything that makes the desktop app more than a browser tab lives here: one window
//! with its own title bar (the frontend draws it; this side only has to allow dragging and
//! the three buttons), a tray icon so closing the window can mean "keep running", the
//! start-up preferences, and a small file where the frontend keeps the accounts it can
//! switch between. The frontend talks to all of it through the commands at the bottom.

use std::{
    fs,
    io::Write,
    path::PathBuf,
    sync::Mutex,
    time::Duration,
};

use serde::{Deserialize, Serialize};
use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Manager, WindowEvent,
};

const MAIN_WINDOW: &str = "main";
const ACCOUNTS_FILE: &str = "accounts.json";
const PREFS_FILE: &str = "prefs.json";

/// Start-up and window behaviour the person chose in Settings -> Desktop. Kept on disk
/// (and in memory, for the close handler) on this side because the window-close event
/// and the `--minimized` launch both happen before the frontend is up.
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(default, rename_all = "camelCase")]
pub struct Prefs {
    /// Closing the window hides it to the tray instead of quitting - what Discord does,
    /// so a closed window still rings for calls and shows notifications.
    pub close_to_tray: bool,
    /// When launched at login (the autostart plugin passes `--minimized`), start hidden in
    /// the tray rather than opening the window.
    pub start_minimized: bool,
}

impl Default for Prefs {
    fn default() -> Self {
        Self {
            close_to_tray: true,
            start_minimized: true,
        }
    }
}

struct PrefsState(Mutex<Prefs>);

/// Whether the frontend has asked for the window yet. The window is created hidden and
/// shown on the frontend's first paint (no white flash while the webview loads), with a
/// fallback timer so a frontend that never loads still leaves something to look at.
struct Shown(Mutex<bool>);

fn config_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app.path().app_config_dir().map_err(|e| e.to_string())?;
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir)
}

fn read_json(path: &PathBuf) -> Option<serde_json::Value> {
    let raw = fs::read(path).ok()?;
    serde_json::from_slice(&raw).ok()
}

/// Write-then-rename so a crash mid-write never leaves a half file, and owner-only on
/// Unix because the accounts file holds session tokens.
fn write_json(path: &PathBuf, value: &serde_json::Value) -> Result<(), String> {
    let tmp = path.with_extension("json.tmp");
    {
        let mut f = fs::File::create(&tmp).map_err(|e| e.to_string())?;
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            let _ = f.set_permissions(fs::Permissions::from_mode(0o600));
        }
        let bytes = serde_json::to_vec_pretty(value).map_err(|e| e.to_string())?;
        f.write_all(&bytes).map_err(|e| e.to_string())?;
        f.sync_all().map_err(|e| e.to_string())?;
    }
    fs::rename(&tmp, path).map_err(|e| e.to_string())
}

fn load_prefs(app: &AppHandle) -> Prefs {
    config_dir(app)
        .ok()
        .and_then(|d| read_json(&d.join(PREFS_FILE)))
        .and_then(|v| serde_json::from_value(v).ok())
        .unwrap_or_default()
}

fn show_main(app: &AppHandle) {
    if let Some(w) = app.get_webview_window(MAIN_WINDOW) {
        let _ = w.show();
        let _ = w.unminimize();
        let _ = w.set_focus();
    }
}

fn reveal_main_once(app: &AppHandle) {
    let state = app.state::<Shown>();
    let mut shown = state.0.lock().unwrap();
    if *shown {
        return;
    }
    *shown = true;
    show_main(app);
}

// ---- commands ----------------------------------------------------------------------------

/// The accounts the frontend can switch between, as it stored them. The shape is the
/// frontend's business (see src/desktop/accounts.ts); this side only keeps the bytes.
#[tauri::command]
fn desktop_accounts_load(app: AppHandle) -> Result<serde_json::Value, String> {
    let dir = config_dir(&app)?;
    Ok(read_json(&dir.join(ACCOUNTS_FILE)).unwrap_or(serde_json::Value::Null))
}

#[tauri::command]
fn desktop_accounts_save(app: AppHandle, value: serde_json::Value) -> Result<(), String> {
    let dir = config_dir(&app)?;
    write_json(&dir.join(ACCOUNTS_FILE), &value)
}

#[tauri::command]
fn desktop_prefs_load(state: tauri::State<'_, PrefsState>) -> Prefs {
    state.0.lock().unwrap().clone()
}

#[tauri::command]
fn desktop_prefs_save(app: AppHandle, state: tauri::State<'_, PrefsState>, prefs: Prefs) -> Result<(), String> {
    let dir = config_dir(&app)?;
    write_json(&dir.join(PREFS_FILE), &serde_json::to_value(&prefs).map_err(|e| e.to_string())?)?;
    *state.0.lock().unwrap() = prefs;
    Ok(())
}

/// The frontend has painted: show the window, unless this launch was asked to stay in
/// the tray.
#[tauri::command]
fn desktop_ready(app: AppHandle, state: tauri::State<'_, PrefsState>) {
    let minimized_launch = std::env::args().any(|a| a == "--minimized");
    if minimized_launch && state.0.lock().unwrap().start_minimized {
        // Mark it shown so the fallback timer does not pop the window up later either.
        *app.state::<Shown>().0.lock().unwrap() = true;
        return;
    }
    reveal_main_once(&app);
}

/// Bring the window back (from the tray, or a notification).
#[tauri::command]
fn desktop_show(app: AppHandle) {
    show_main(&app);
}

// ---- app -----------------------------------------------------------------------------------

fn build_tray(app: &AppHandle) -> tauri::Result<()> {
    let show = MenuItem::with_id(app, "show", "Open Strafe", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "Quit Strafe", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&show, &PredefinedMenuItem::separator(app)?, &quit])?;
    let mut tray = TrayIconBuilder::with_id("main")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .tooltip("Strafe")
        .on_menu_event(|app, event| match event.id.as_ref() {
            "show" => show_main(app),
            "quit" => app.exit(0),
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                show_main(tray.app_handle());
            }
        });
    if let Some(icon) = app.default_window_icon() {
        tray = tray.icon(icon.clone());
    }
    tray.build(app)?;
    Ok(())
}

/// WebKitGTK has WebRTC and getUserMedia off by default, which would leave the Linux app
/// unable to join a voice room or share a screen. Chromium (Windows) and WebKit on macOS
/// need nothing.
#[cfg(target_os = "linux")]
fn enable_media(app: &AppHandle) {
    use webkit2gtk::{SettingsExt, WebViewExt};
    if let Some(w) = app.get_webview_window(MAIN_WINDOW) {
        let _ = w.with_webview(|webview| {
            let wv = webview.inner();
            if let Some(settings) = WebViewExt::settings(&wv) {
                settings.set_enable_webrtc(true);
                settings.set_enable_media_stream(true);
                settings.set_enable_media_capabilities(true);
            }
        });
    }
}

#[cfg(not(target_os = "linux"))]
fn enable_media(_app: &AppHandle) {}

pub fn run() {
    let builder = tauri::Builder::default();

    // A second launch (double-clicking the icon while it sits in the tray) must raise the
    // running window, not open a second one with its own gateway session. Registered first,
    // as the plugin requires.
    #[cfg(not(any(target_os = "android", target_os = "ios")))]
    let builder = builder.plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| show_main(app)));

    let builder = builder
        .plugin(
            tauri_plugin_window_state::Builder::default()
                // Visibility is ours: the window starts hidden and is shown on first paint
                // (or kept in the tray for a `--minimized` launch).
                .with_state_flags(tauri_plugin_window_state::StateFlags::all() & !tauri_plugin_window_state::StateFlags::VISIBLE)
                .build(),
        )
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_process::init());

    #[cfg(not(any(target_os = "android", target_os = "ios")))]
    let builder = builder
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            Some(vec!["--minimized"]),
        ));

    builder
        .manage(PrefsState(Mutex::new(Prefs::default())))
        .manage(Shown(Mutex::new(false)))
        .invoke_handler(tauri::generate_handler![
            desktop_accounts_load,
            desktop_accounts_save,
            desktop_prefs_load,
            desktop_prefs_save,
            desktop_ready,
            desktop_show,
        ])
        .setup(|app| {
            let handle = app.handle().clone();
            *app.state::<PrefsState>().0.lock().unwrap() = load_prefs(&handle);
            build_tray(&handle)?;
            enable_media(&handle);
            // If the frontend never calls desktop_ready (dev server down, a broken build),
            // show the window anyway so the failure is visible instead of a silent process.
            let fallback = handle.clone();
            std::thread::spawn(move || {
                std::thread::sleep(Duration::from_secs(8));
                reveal_main_once(&fallback);
            });
            Ok(())
        })
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                if window.label() != MAIN_WINDOW {
                    return;
                }
                let close_to_tray = window.app_handle().state::<PrefsState>().0.lock().unwrap().close_to_tray;
                if close_to_tray {
                    api.prevent_close();
                    let _ = window.hide();
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running Strafe");
}
