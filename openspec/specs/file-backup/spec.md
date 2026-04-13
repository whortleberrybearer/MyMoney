### Requirement: Auto-backup created on every successful startup
The app SHALL automatically create a backup of the data file on every startup where an existing data file is successfully found and opened. No backup SHALL be created when a brand-new file is created for the first time.

#### Scenario: Backup created on successful startup
- **WHEN** the app starts
- **AND** the last-used file exists and is accessible
- **THEN** a backup file is created in the same folder as the data file
- **AND** the backup filename follows the format `{filename}.{YYYY-MM-DD}.bak`
- **AND** for example, `my-money.pfdata` backed up on 2026-04-13 produces `my-money.pfdata.2026-04-13.bak`

#### Scenario: No backup created for a newly created file
- **WHEN** the user creates a brand-new data file
- **THEN** no backup is created
- **AND** the user proceeds directly to the dashboard

---

### Requirement: Same-day backup is overwritten
If a backup file with today's date already exists, the app SHALL overwrite it rather than create a duplicate.

#### Scenario: Backup already exists for today
- **WHEN** the app starts
- **AND** a backup file named `{filename}.{YYYY-MM-DD}.bak` for today's date already exists in the same folder
- **THEN** the existing backup file is overwritten with a fresh copy

---

### Requirement: Only 2 most recent backups are retained
After creating a backup, the app SHALL delete any backup files beyond the 2 most recent, based on the date in the filename.

#### Scenario: More than 2 backups exist after creation
- **WHEN** a new backup is created
- **AND** there are now more than 2 backup files matching `{filename}.*.bak` in the folder
- **THEN** all backup files except the 2 most recent (by date in filename, descending) are deleted

#### Scenario: 2 or fewer backups exist
- **WHEN** a new backup is created
- **AND** there are 2 or fewer backup files matching `{filename}.*.bak` in the folder
- **THEN** no backup files are deleted

---

### Requirement: Backup failure does not block app startup
If the backup process fails for any reason, the app SHALL continue loading and route the user to the dashboard. The failure SHALL be logged but SHALL NOT be surfaced as a blocking error to the user.

#### Scenario: Backup encounters an error
- **WHEN** the backup creation or cleanup step fails
- **THEN** the error is logged
- **AND** the app continues to the dashboard without interruption
