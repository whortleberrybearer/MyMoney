pub mod starling;

use serde::{Deserialize, Serialize};

/// A bank account discovered via an institution API.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiAccount {
    /// Institution-assigned unique identifier for this account.
    pub external_id: String,
    pub name: String,
    pub currency: String,
    /// Raw account type string from the API (e.g. "PRIMARY", "SAVINGS").
    pub account_type_raw: String,
}

/// A transaction fetched via an institution API.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiTransaction {
    /// Institution-assigned unique identifier for this transaction.
    pub external_id: String,
    /// ISO date YYYY-MM-DD.
    pub date: String,
    /// Signed amount: positive = credit, negative = debit.
    pub amount: f64,
    pub description: String,
}

/// Trait implemented by each institution integration (Starling, Monzo, …).
pub trait ApiIntegration: Send + Sync {
    /// Discover the accounts available under this PAT.
    fn discover_accounts(
        &self,
        pat: &str,
    ) -> impl std::future::Future<Output = Result<Vec<ApiAccount>, String>> + Send;

    /// Fetch transactions for a given account external ID from `from_date` (ISO date) to now.
    fn fetch_transactions(
        &self,
        pat: &str,
        account_external_id: &str,
        from_date: &str,
    ) -> impl std::future::Future<Output = Result<Vec<ApiTransaction>, String>> + Send;
}
