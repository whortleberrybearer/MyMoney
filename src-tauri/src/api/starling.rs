use serde::Deserialize;

use super::{ApiAccount, ApiIntegration, ApiTransaction};

const BASE_URL: &str = "https://api.starlingbank.com";

/// Known Starling account type → MyMoney account type mapping.
/// Any unknown value falls back to "Current".
fn map_account_type(raw: &str) -> &'static str {
    match raw {
        "PRIMARY" | "ADDITIONAL" => "Current",
        "LOAN" => "Mortgage",
        "FIXED_TERM_DEPOSIT" => "Savings",
        _ => "Current",
    }
}

// ---------------------------------------------------------------------------
// Starling API response shapes
// ---------------------------------------------------------------------------

#[derive(Deserialize)]
struct StarlingAccountsResponse {
    accounts: Vec<StarlingAccount>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct StarlingAccount {
    account_uid: String,
    name: String,
    currency: String,
    account_type: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct StarlingFeedResponse {
    feed_items: Vec<StarlingFeedItem>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct StarlingFeedItem {
    feed_item_uid: String,
    transaction_time: String,
    amount: StarlingAmount,
    direction: String,
    reference: Option<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct StarlingAmount {
    minor_units: i64,
    #[allow(dead_code)]
    currency: String,
}

// ---------------------------------------------------------------------------
// Mapper functions — pure functions, easily unit-tested
// ---------------------------------------------------------------------------

pub(crate) fn map_account(raw: &StarlingAccount) -> ApiAccount {
    ApiAccount {
        external_id: raw.account_uid.clone(),
        name: raw.name.clone(),
        currency: raw.currency.clone(),
        account_type_raw: map_account_type(&raw.account_type).to_string(),
    }
}

pub(crate) fn map_transaction(item: &StarlingFeedItem) -> ApiTransaction {
    // Starling amounts are in minor units (pence). Positive = money received (IN),
    // negative = money spent (OUT).
    let amount_major = item.amount.minor_units as f64 / 100.0;
    let signed_amount = if item.direction == "IN" {
        amount_major
    } else {
        -amount_major
    };

    // transaction_time is ISO 8601 with timezone; take just the date portion.
    let date = item
        .transaction_time
        .get(..10)
        .unwrap_or(&item.transaction_time)
        .to_string();

    ApiTransaction {
        external_id: item.feed_item_uid.clone(),
        date,
        amount: signed_amount,
        description: item.reference.clone().unwrap_or_default(),
    }
}

// ---------------------------------------------------------------------------
// HTTP integration
// ---------------------------------------------------------------------------

pub struct StarlingIntegration {
    client: reqwest::Client,
    base_url: String,
}

impl StarlingIntegration {
    pub fn new() -> Self {
        Self {
            client: reqwest::Client::new(),
            base_url: BASE_URL.to_string(),
        }
    }

    /// For testing: override the base URL to point at a mock server.
    #[cfg(test)]
    pub fn with_base_url(base_url: impl Into<String>) -> Self {
        Self {
            client: reqwest::Client::new(),
            base_url: base_url.into(),
        }
    }
}

impl ApiIntegration for StarlingIntegration {
    async fn discover_accounts(&self, pat: &str) -> Result<Vec<ApiAccount>, String> {
        let url = format!("{}/api/v2/accounts", self.base_url);
        let response = self
            .client
            .get(&url)
            .bearer_auth(pat)
            .send()
            .await
            .map_err(|e| format!("request failed: {}", e))?;

        if !response.status().is_success() {
            let status = response.status().as_u16();
            return Err(format!("Starling API returned status {}", status));
        }

        let body: StarlingAccountsResponse = response
            .json()
            .await
            .map_err(|e| format!("failed to parse accounts response: {}", e))?;

        Ok(body.accounts.iter().map(map_account).collect())
    }

    async fn fetch_transactions(
        &self,
        pat: &str,
        account_external_id: &str,
        from_date: &str,
    ) -> Result<Vec<ApiTransaction>, String> {
        let now = chrono::Utc::now().format("%Y-%m-%dT%H:%M:%S%.3fZ").to_string();
        let min_ts = format!("{}T00:00:00.000Z", from_date);

        let url = format!(
            "{}/api/v2/feed/account/{}/settled-transactions?changesSince={}",
            self.base_url, account_external_id, min_ts
        );

        let response = self
            .client
            .get(&url)
            .bearer_auth(pat)
            .send()
            .await
            .map_err(|e| format!("request failed: {}", e))?;

        if !response.status().is_success() {
            let status = response.status().as_u16();
            return Err(format!("Starling API returned status {}", status));
        }

        let body: StarlingFeedResponse = response
            .json()
            .await
            .map_err(|e| format!("failed to parse transactions response: {}", e))?;

        // Suppress unused variable warning — `now` is kept for context but not
        // needed in the URL since Starling returns all settled transactions after changesSince.
        let _ = now;

        Ok(body.feed_items.iter().map(map_transaction).collect())
    }
}

// ---------------------------------------------------------------------------
// Unit tests — pure mapper logic, no HTTP
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;

    fn make_account(uid: &str, name: &str, currency: &str, account_type: &str) -> StarlingAccount {
        StarlingAccount {
            account_uid: uid.to_string(),
            name: name.to_string(),
            currency: currency.to_string(),
            account_type: account_type.to_string(),
        }
    }

    fn make_feed_item(uid: &str, time: &str, minor_units: i64, direction: &str, reference: Option<&str>) -> StarlingFeedItem {
        StarlingFeedItem {
            feed_item_uid: uid.to_string(),
            transaction_time: time.to_string(),
            amount: StarlingAmount {
                minor_units,
                currency: "GBP".to_string(),
            },
            direction: direction.to_string(),
            reference: reference.map(str::to_string),
        }
    }

    // --- Account mapper tests (task 3.5) ---

    #[test]
    fn account_mapper_maps_all_fields() {
        let raw = make_account("uid-1", "Personal Account", "GBP", "PRIMARY");
        let mapped = map_account(&raw);
        assert_eq!(mapped.external_id, "uid-1");
        assert_eq!(mapped.name, "Personal Account");
        assert_eq!(mapped.currency, "GBP");
        assert_eq!(mapped.account_type_raw, "Current");
    }

    #[test]
    fn account_mapper_primary_maps_to_current() {
        let raw = make_account("x", "x", "GBP", "PRIMARY");
        assert_eq!(map_account(&raw).account_type_raw, "Current");
    }

    #[test]
    fn account_mapper_loan_maps_to_mortgage() {
        let raw = make_account("x", "x", "GBP", "LOAN");
        assert_eq!(map_account(&raw).account_type_raw, "Mortgage");
    }

    #[test]
    fn account_mapper_fixed_term_maps_to_savings() {
        let raw = make_account("x", "x", "GBP", "FIXED_TERM_DEPOSIT");
        assert_eq!(map_account(&raw).account_type_raw, "Savings");
    }

    // --- Unknown account type fallback (task 3.7) ---

    #[test]
    fn account_mapper_unknown_type_falls_back_to_current() {
        let raw = make_account("x", "x", "GBP", "SOME_FUTURE_TYPE");
        assert_eq!(map_account(&raw).account_type_raw, "Current");
    }

    // --- Transaction mapper tests (tasks 3.6) ---

    #[test]
    fn transaction_mapper_credit_in_is_positive() {
        let item = make_feed_item("tx-1", "2024-03-15T10:30:00.000Z", 5000, "IN", Some("Salary"));
        let mapped = map_transaction(&item);
        assert_eq!(mapped.amount, 50.0);
        assert_eq!(mapped.external_id, "tx-1");
        assert_eq!(mapped.date, "2024-03-15");
        assert_eq!(mapped.description, "Salary");
    }

    #[test]
    fn transaction_mapper_debit_out_is_negative() {
        let item = make_feed_item("tx-2", "2024-03-16T09:00:00.000Z", 1250, "OUT", Some("TESCO"));
        let mapped = map_transaction(&item);
        assert_eq!(mapped.amount, -12.50);
    }

    #[test]
    fn transaction_mapper_zero_amount_stays_zero() {
        let item = make_feed_item("tx-3", "2024-03-17T00:00:00.000Z", 0, "IN", None);
        let mapped = map_transaction(&item);
        assert_eq!(mapped.amount, 0.0);
    }

    #[test]
    fn transaction_mapper_missing_reference_is_empty_string() {
        let item = make_feed_item("tx-4", "2024-03-18T00:00:00.000Z", 100, "OUT", None);
        let mapped = map_transaction(&item);
        assert_eq!(mapped.description, "");
    }

    #[test]
    fn transaction_mapper_date_truncated_to_ymd() {
        let item = make_feed_item("tx-5", "2024-12-31T23:59:59.999Z", 100, "IN", None);
        let mapped = map_transaction(&item);
        assert_eq!(mapped.date, "2024-12-31");
    }
}
