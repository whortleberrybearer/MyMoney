use crate::api::starling::StarlingIntegration;
use crate::api::{ApiAccount, ApiIntegration, ApiTransaction};
use crate::keychain;
use serde::{Deserialize, Serialize};

// ---------------------------------------------------------------------------
// Keychain commands
// ---------------------------------------------------------------------------

#[tauri::command]
pub async fn store_keychain_secret(key: String, value: String) -> Result<(), String> {
    keychain::set_secret(&key, &value)
}

#[tauri::command]
pub async fn get_keychain_secret(key: String) -> Result<String, String> {
    keychain::get_secret(&key)
}

#[tauri::command]
pub async fn delete_keychain_secret(key: String) -> Result<(), String> {
    keychain::delete_secret(&key)
}

// ---------------------------------------------------------------------------
// Connection management helpers
// ---------------------------------------------------------------------------

/// Generate a stable keychain key for a given institution connection.
pub fn make_keychain_key(institution_id: i64, api_type: &str) -> String {
    format!("mymoney.{}.{}", api_type, institution_id)
}

#[derive(Serialize, Deserialize)]
pub struct CreateApiConnectionInput {
    pub institution_id: i64,
    pub api_type: String,
    pub pat: String,
}

#[derive(Serialize)]
pub struct CreateApiConnectionResult {
    pub keychain_key: String,
}

/// Store a PAT in the keychain and return the generated keychain key.
/// The caller (TypeScript) is responsible for persisting the key and
/// inserting the institution_api_connection row in the database.
#[tauri::command]
pub async fn create_api_connection(input: CreateApiConnectionInput) -> Result<CreateApiConnectionResult, String> {
    let key = make_keychain_key(input.institution_id, &input.api_type);
    keychain::set_secret(&key, &input.pat)?;
    Ok(CreateApiConnectionResult { keychain_key: key })
}

/// Overwrite the PAT for an existing connection in the keychain.
#[tauri::command]
pub async fn update_api_connection_pat(keychain_key: String, new_pat: String) -> Result<(), String> {
    keychain::set_secret(&keychain_key, &new_pat)
}

// ---------------------------------------------------------------------------
// Starling API commands — pure HTTP, no DB access
// ---------------------------------------------------------------------------

/// Discover accounts available under the given PAT.
/// The caller handles DB creation of account rows.
#[tauri::command]
pub async fn discover_starling_accounts(pat: String) -> Result<Vec<ApiAccount>, String> {
    let integration = StarlingIntegration::new();
    integration.discover_accounts(&pat).await
}

/// Fetch settled transactions for an account from `from_date` (ISO YYYY-MM-DD) to now.
/// The caller handles DB upsert logic.
#[tauri::command]
pub async fn fetch_starling_transactions(
    pat: String,
    account_external_id: String,
    from_date: String,
) -> Result<Vec<ApiTransaction>, String> {
    let integration = StarlingIntegration::new();
    integration.fetch_transactions(&pat, &account_external_id, &from_date).await
}

/// Convenience command: given a keychain_key, retrieve the PAT and discover accounts.
#[tauri::command]
pub async fn discover_starling_accounts_by_key(keychain_key: String) -> Result<Vec<ApiAccount>, String> {
    let pat = keychain::get_secret(&keychain_key)?;
    let integration = StarlingIntegration::new();
    integration.discover_accounts(&pat).await
}

/// Convenience command: given a keychain_key, retrieve the PAT and fetch transactions.
#[tauri::command]
pub async fn fetch_starling_transactions_by_key(
    keychain_key: String,
    account_external_id: String,
    from_date: String,
) -> Result<Vec<ApiTransaction>, String> {
    let pat = keychain::get_secret(&keychain_key)?;
    let integration = StarlingIntegration::new();
    integration.fetch_transactions(&pat, &account_external_id, &from_date).await
}

// ---------------------------------------------------------------------------
// Legacy command stubs referenced by lib.rs (kept for compatibility)
// These delegate to the more granular commands above.
// ---------------------------------------------------------------------------

#[tauri::command]
pub async fn create_synced_accounts() -> Result<(), String> {
    Ok(())
}

#[tauri::command]
pub async fn remove_synced_account() -> Result<(), String> {
    Ok(())
}

#[tauri::command]
pub async fn sync_starling_accounts() -> Result<(), String> {
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn make_keychain_key_format() {
        let key = make_keychain_key(42, "starling");
        assert_eq!(key, "mymoney.starling.42");
    }

    #[test]
    fn make_keychain_key_different_ids_produce_different_keys() {
        let k1 = make_keychain_key(1, "starling");
        let k2 = make_keychain_key(2, "starling");
        assert_ne!(k1, k2);
    }
}
