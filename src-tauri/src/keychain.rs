const SERVICE: &str = "mymoney";

pub fn set_secret(key: &str, value: &str) -> Result<(), String> {
    let entry = keyring::Entry::new(SERVICE, key).map_err(|e| e.to_string())?;
    entry.set_password(value).map_err(|e| e.to_string())
}

pub fn get_secret(key: &str) -> Result<String, String> {
    let entry = keyring::Entry::new(SERVICE, key).map_err(|e| e.to_string())?;
    entry.get_password().map_err(|e| e.to_string())
}

pub fn delete_secret(key: &str) -> Result<(), String> {
    let entry = keyring::Entry::new(SERVICE, key).map_err(|e| e.to_string())?;
    entry.delete_credential().map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    // Keychain tests require a real OS keychain. We use a unique key prefix
    // so parallel test runs don't collide, and clean up after themselves.

    fn unique_key(suffix: &str) -> String {
        format!("test-{}-{}", std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .subsec_nanos(), suffix)
    }

    // These tests require a real OS keychain. Run with: cargo test -- --include-ignored
    #[test]
    #[ignore = "requires OS keychain (Windows Credential Manager / macOS Keychain)"]
    fn set_and_get_roundtrip() {
        let key = unique_key("roundtrip");
        set_secret(&key, "super-secret-pat").expect("set failed");
        let retrieved = get_secret(&key).expect("get failed");
        assert_eq!(retrieved, "super-secret-pat");
        let _ = delete_secret(&key);
    }

    #[test]
    #[ignore = "requires OS keychain (Windows Credential Manager / macOS Keychain)"]
    fn overwrite_replaces_value() {
        let key = unique_key("overwrite");
        set_secret(&key, "first-value").expect("initial set failed");
        set_secret(&key, "second-value").expect("overwrite failed");
        let retrieved = get_secret(&key).expect("get failed");
        assert_eq!(retrieved, "second-value");
        let _ = delete_secret(&key);
    }

    #[test]
    fn get_missing_key_returns_error() {
        let key = unique_key("missing");
        let result = get_secret(&key);
        assert!(result.is_err(), "expected error for missing key, got {:?}", result);
    }
}
