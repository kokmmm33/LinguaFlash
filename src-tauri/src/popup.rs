use tauri::{AppHandle, Emitter, Manager, WebviewUrl, WebviewWindowBuilder};

/// 鼠标位置结构体
#[derive(Debug, Clone, Copy)]
pub struct MousePosition {
    pub x: i32,
    pub y: i32,
}

/// 获取鼠标当前位置
#[cfg(target_os = "macos")]
pub fn get_mouse_position() -> MousePosition {
    use core_graphics::event::CGEvent;
    use core_graphics::event_source::{CGEventSource, CGEventSourceStateID};

    let source = CGEventSource::new(CGEventSourceStateID::HIDSystemState)
        .expect("Failed to create CGEventSource");
    let event = CGEvent::new(source).expect("Failed to create CGEvent");
    let point = event.location();

    MousePosition {
        x: point.x as i32,
        y: point.y as i32,
    }
}

/// 获取鼠标当前位置
#[cfg(target_os = "windows")]
pub fn get_mouse_position() -> MousePosition {
    use windows::Win32::Foundation::POINT;
    use windows::Win32::UI::WindowsAndMessaging::GetCursorPos;

    let mut point = POINT { x: 0, y: 0 };
    unsafe {
        let _ = GetCursorPos(&mut point);
    }

    MousePosition {
        x: point.x,
        y: point.y,
    }
}

/// 计算悬浮窗位置，避开屏幕边缘
pub fn calculate_popup_position(
    mouse_pos: MousePosition,
    popup_width: i32,
    popup_height: i32,
    screen_width: i32,
    screen_height: i32,
) -> (i32, i32) {
    // 默认在鼠标右下方显示，偏移 10 像素
    let offset = 10;
    let mut x = mouse_pos.x + offset;
    let mut y = mouse_pos.y + offset;

    // 检查右边界
    if x + popup_width > screen_width {
        // 显示在鼠标左侧
        x = mouse_pos.x - popup_width - offset;
    }

    // 检查下边界
    if y + popup_height > screen_height {
        // 显示在鼠标上方
        y = mouse_pos.y - popup_height - offset;
    }

    // 确保不超出左边界和上边界
    if x < 0 {
        x = 0;
    }
    if y < 0 {
        y = 0;
    }

    (x, y)
}

/// 悬浮窗常量
const POPUP_WINDOW_LABEL: &str = "popup";
const POPUP_WIDTH: f64 = 400.0;
const POPUP_HEIGHT: f64 = 300.0;

/// 显示悬浮窗
pub async fn show_popup(app: &AppHandle, text: String) -> Result<(), String> {
    let mouse_pos = get_mouse_position();

    // 获取主显示器尺寸
    let monitors = app.available_monitors().map_err(|e| e.to_string())?;
    let (screen_width, screen_height) = if let Some(monitor) = monitors.first() {
        let size = monitor.size();
        (size.width as i32, size.height as i32)
    } else {
        // 默认屏幕尺寸
        (1920, 1080)
    };

    // 计算窗口位置
    let (x, y) = calculate_popup_position(
        mouse_pos,
        POPUP_WIDTH as i32,
        POPUP_HEIGHT as i32,
        screen_width,
        screen_height,
    );

    // 检查窗口是否已存在
    if let Some(window) = app.get_webview_window(POPUP_WINDOW_LABEL) {
        // 窗口已存在，更新位置并显示
        window
            .set_position(tauri::Position::Physical(tauri::PhysicalPosition { x, y }))
            .map_err(|e| format!("设置窗口位置失败: {}", e))?;
        window
            .show()
            .map_err(|e| format!("显示窗口失败: {}", e))?;
        window
            .set_focus()
            .map_err(|e| format!("聚焦窗口失败: {}", e))?;

        // 发送翻译事件
        window
            .emit("popup-translate", text)
            .map_err(|e| format!("发送事件失败: {}", e))?;
    } else {
        // 创建新窗口
        let window = WebviewWindowBuilder::new(
            app,
            POPUP_WINDOW_LABEL,
            WebviewUrl::App("popup.html".into()),
        )
        .title("TTime 翻译")
        .inner_size(POPUP_WIDTH, POPUP_HEIGHT)
        .position(x as f64, y as f64)
        .decorations(false) // 无边框
        .always_on_top(true) // 始终置顶
        .skip_taskbar(true) // 不显示在任务栏
        .resizable(false) // 不可调整大小
        .focused(true) // 聚焦
        .visible(true)
        .build()
        .map_err(|e| format!("创建悬浮窗失败: {}", e))?;

        // 发送翻译事件（稍后延迟发送，等待窗口加载）
        let app_clone = app.clone();
        let text_clone = text.clone();
        tauri::async_runtime::spawn(async move {
            // 等待窗口加载
            tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;
            if let Some(window) = app_clone.get_webview_window(POPUP_WINDOW_LABEL) {
                let _ = window.emit("popup-translate", text_clone);
            }
        });

        // 确保窗口已创建
        let _ = window;
    }

    Ok(())
}

/// 关闭/隐藏悬浮窗
pub fn close_popup(app: &AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window(POPUP_WINDOW_LABEL) {
        window
            .hide()
            .map_err(|e| format!("隐藏窗口失败: {}", e))?;
    }
    Ok(())
}
