use serde::Serialize;
use std::path::Path;
use std::process::Command;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct GitRepoInfo {
    is_repo: bool,
    branch: Option<String>,
    remote_url: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct GitSyncResult {
    branch: String,
    committed: bool,
    clean: bool,
    pull_output: String,
    push_output: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct GitChangeStatus {
    is_repo: bool,
    has_remote: bool,
    has_changes: bool,
}

fn run_git_in(path: &str, args: &[&str]) -> Result<String, String> {
    let output = Command::new("git")
        .current_dir(path)
        .args(args)
        .output()
        .map_err(|err| format!("Failed to run git {:?}: {}", args, err))?;

    let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();

    if output.status.success() {
        Ok(stdout)
    } else if stderr.is_empty() {
        Err(format!("git {:?} failed with status {}", args, output.status))
    } else {
        Err(stderr)
    }
}

fn ensure_git_available() -> Result<(), String> {
    let output = Command::new("git")
        .arg("--version")
        .output()
        .map_err(|_| "Git is not available. Please install Git first.".to_string())?;
    if output.status.success() {
        Ok(())
    } else {
        Err("Git is not available. Please install Git first.".to_string())
    }
}

fn ensure_path_exists(path: &str) -> Result<(), String> {
    if Path::new(path).exists() {
        Ok(())
    } else {
        Err(format!("Path does not exist: {}", path))
    }
}

fn is_git_repo(path: &str) -> bool {
    run_git_in(path, &["rev-parse", "--is-inside-work-tree"]).is_ok()
}

fn current_branch(path: &str) -> Result<String, String> {
    run_git_in(path, &["rev-parse", "--abbrev-ref", "HEAD"])
}

#[tauri::command]
fn git_get_repo_info(root_path: String) -> Result<GitRepoInfo, String> {
    ensure_git_available()?;
    ensure_path_exists(&root_path)?;

    if !is_git_repo(&root_path) {
        return Ok(GitRepoInfo {
            is_repo: false,
            branch: None,
            remote_url: None,
        });
    }

    let branch = current_branch(&root_path).ok();
    let remote_url = run_git_in(&root_path, &["remote", "get-url", "origin"]).ok();

    Ok(GitRepoInfo {
        is_repo: true,
        branch,
        remote_url,
    })
}

#[tauri::command]
fn git_init_repo(root_path: String) -> Result<GitRepoInfo, String> {
    ensure_git_available()?;
    ensure_path_exists(&root_path)?;

    if !is_git_repo(&root_path) {
        run_git_in(&root_path, &["init"])?;
    }

    let branch = current_branch(&root_path).ok();
    let remote_url = run_git_in(&root_path, &["remote", "get-url", "origin"]).ok();
    Ok(GitRepoInfo {
        is_repo: true,
        branch,
        remote_url,
    })
}

#[tauri::command]
fn git_set_remote(root_path: String, remote_url: String) -> Result<GitRepoInfo, String> {
    ensure_git_available()?;
    ensure_path_exists(&root_path)?;
    if !is_git_repo(&root_path) {
        return Err("Current vault is not a Git repository.".to_string());
    }

    let url = remote_url.trim();
    if url.is_empty() {
        return Err("Remote URL cannot be empty.".to_string());
    }

    let has_origin = run_git_in(&root_path, &["remote", "get-url", "origin"]).is_ok();
    if has_origin {
        run_git_in(&root_path, &["remote", "set-url", "origin", url])?;
    } else {
        run_git_in(&root_path, &["remote", "add", "origin", url])?;
    }

    Ok(GitRepoInfo {
        is_repo: true,
        branch: current_branch(&root_path).ok(),
        remote_url: run_git_in(&root_path, &["remote", "get-url", "origin"]).ok(),
    })
}

#[tauri::command]
fn git_sync_notes(root_path: String, commit_message: Option<String>) -> Result<GitSyncResult, String> {
    ensure_git_available()?;
    ensure_path_exists(&root_path)?;
    if !is_git_repo(&root_path) {
        return Err("Current vault is not a Git repository.".to_string());
    }

    let branch = current_branch(&root_path)?;
    let remote = run_git_in(&root_path, &["remote", "get-url", "origin"]).ok();
    if remote.is_none() {
        return Err("No remote named 'origin'. Set remote before syncing.".to_string());
    }

    run_git_in(&root_path, &["add", "-A"])?;

    let porcelain = run_git_in(&root_path, &["status", "--porcelain"])?;
    let has_changes = !porcelain.trim().is_empty();
    if has_changes {
        let message = commit_message
            .as_deref()
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .unwrap_or("chore(notes): sync vault");
        run_git_in(&root_path, &["commit", "-m", message])?;
    }

    let pull_output = run_git_in(
        &root_path,
        &["pull", "--rebase", "--autostash", "origin", branch.as_str()],
    )?;
    let push_output = run_git_in(&root_path, &["push", "origin", branch.as_str()])?;

    let clean = run_git_in(&root_path, &["status", "--porcelain"])?
        .trim()
        .is_empty();

    Ok(GitSyncResult {
        branch,
        committed: has_changes,
        clean,
        pull_output,
        push_output,
    })
}

#[tauri::command]
fn git_get_change_status(root_path: String) -> Result<GitChangeStatus, String> {
    ensure_git_available()?;
    ensure_path_exists(&root_path)?;

    if !is_git_repo(&root_path) {
        return Ok(GitChangeStatus {
            is_repo: false,
            has_remote: false,
            has_changes: false,
        });
    }

    let has_remote = run_git_in(&root_path, &["remote", "get-url", "origin"]).is_ok();
    let has_changes = !run_git_in(&root_path, &["status", "--porcelain"])?
        .trim()
        .is_empty();

    Ok(GitChangeStatus {
        is_repo: true,
        has_remote,
        has_changes,
    })
}

#[tauri::command]
fn open_in_terminal(root_path: String) -> Result<(), String> {
    ensure_path_exists(&root_path)?;

    #[cfg(target_os = "macos")]
    {
        let status = Command::new("open")
            .arg("-a")
            .arg("Terminal")
            .arg(&root_path)
            .status()
            .map_err(|err| format!("Failed to open Terminal: {}", err))?;
        if status.success() {
            return Ok(());
        }
        return Err("Failed to open Terminal.".to_string());
    }

    #[cfg(target_os = "linux")]
    {
        let status = Command::new("xdg-open")
            .arg(&root_path)
            .status()
            .map_err(|err| format!("Failed to open folder: {}", err))?;
        if status.success() {
            return Ok(());
        }
        return Err("Failed to open folder.".to_string());
    }

    #[cfg(target_os = "windows")]
    {
        let status = Command::new("cmd")
            .arg("/C")
            .arg("start")
            .arg("")
            .arg(&root_path)
            .status()
            .map_err(|err| format!("Failed to open folder: {}", err))?;
        if status.success() {
            return Ok(());
        }
        return Err("Failed to open folder.".to_string());
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            git_get_repo_info,
            git_init_repo,
            git_set_remote,
            git_sync_notes,
            git_get_change_status,
            open_in_terminal
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
