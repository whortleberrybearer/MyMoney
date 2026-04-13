### Requirement: [F-01] Reference tables exist with correct structure
The database schema SHALL include the following reference tables: `account_type`, `transaction_type`, `tag`, `category`, and `institution`. Each table MUST be created by a Drizzle migration.

#### Scenario: Reference tables exist after first open
- **WHEN** a new `.pfdata` file is opened for the first time
- **AND** Drizzle migrations complete successfully
- **THEN** the tables `account_type`, `transaction_type`, `tag`, `category`, and `institution` all exist in the SQLite file

---

### Requirement: [F-01] account_type seeded with 6 rows
The `account_type` table SHALL be seeded with exactly the following rows. Each row MUST have an `asset_liability` value of either `"asset"` or `"liability"`:

| name | asset_liability |
|---|---|
| Current | asset |
| Savings | asset |
| ISA | asset |
| Stocks & Shares ISA | asset |
| Pension | asset |
| Mortgage | liability |

#### Scenario: account_type contains correct seed data
- **WHEN** migrations have run on a data file
- **THEN** `account_type` contains exactly 6 rows with names and asset_liability values as specified above

#### Scenario: Re-running migrations does not duplicate account_type rows
- **WHEN** the data file is opened multiple times
- **THEN** `account_type` still contains exactly 6 rows

---

### Requirement: [F-01] transaction_type seeded with 3 rows
The `transaction_type` table SHALL be seeded with exactly the following rows:

| name |
|---|
| imported |
| manual |
| virtual_transfer |

#### Scenario: transaction_type contains correct seed data
- **WHEN** migrations have run on a data file
- **THEN** `transaction_type` contains exactly 3 rows with names as specified above

#### Scenario: Re-running migrations does not duplicate transaction_type rows
- **WHEN** the data file is opened multiple times
- **THEN** `transaction_type` still contains exactly 3 rows

---

### Requirement: [F-01] tag seeded with 2 rows
The `tag` table SHALL be seeded with exactly the following rows:

| name |
|---|
| Personal |
| Joint |

#### Scenario: tag contains correct seed data
- **WHEN** migrations have run on a data file
- **THEN** `tag` contains exactly 2 rows: Personal and Joint

#### Scenario: Re-running migrations does not duplicate tag rows
- **WHEN** the data file is opened multiple times
- **THEN** `tag` still contains exactly 2 rows

---

### Requirement: [F-01] category seeded with 30 rows
The `category` table SHALL be seeded with exactly 30 rows. The `Uncategorised` row MUST have `is_system = 1` and `sort_order = 999`. All other rows MUST have `is_system = 0`.

| name | is_system | sort_order |
|---|---|---|
| Uncategorised | 1 | 999 |
| Salary | 0 | 1 |
| Income | 0 | 2 |
| Bills | 0 | 3 |
| Groceries | 0 | 4 |
| Eating out | 0 | 5 |
| Transport | 0 | 6 |
| Vehicle | 0 | 7 |
| Home | 0 | 8 |
| DIY | 0 | 9 |
| Utilities | 0 | 10 |
| Rent / mortgage | 0 | 11 |
| Insurance | 0 | 12 |
| Subscriptions | 0 | 13 |
| Entertainment | 0 | 14 |
| Clothing | 0 | 15 |
| Health | 0 | 16 |
| Fitness | 0 | 17 |
| Holidays | 0 | 18 |
| Gifts | 0 | 19 |
| Charity | 0 | 20 |
| Education | 0 | 21 |
| Hobby | 0 | 22 |
| Pets | 0 | 23 |
| Gambling | 0 | 24 |
| Investment | 0 | 25 |
| Transfer | 0 | 26 |
| Tax | 0 | 27 |
| Fees | 0 | 28 |
| Other | 0 | 29 |

#### Scenario: category contains correct seed data
- **WHEN** migrations have run on a data file
- **THEN** `category` contains exactly 30 rows
- **AND** `Uncategorised` has `is_system = 1` and `sort_order = 999`
- **AND** all other rows have `is_system = 0`

#### Scenario: Re-running migrations does not duplicate category rows
- **WHEN** the data file is opened multiple times
- **THEN** `category` still contains exactly 30 rows

---

### Requirement: [F-01] institution table starts empty
The `institution` table SHALL exist after migrations run and SHALL start with zero rows. Institutions are added by the user when setting up accounts and are never seeded.

#### Scenario: institution table is empty after first open
- **WHEN** migrations have run on a data file for the first time
- **THEN** the `institution` table exists
- **AND** it contains zero rows
