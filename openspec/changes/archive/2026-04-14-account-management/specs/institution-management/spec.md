## ADDED Requirements

### Requirement: [F-04] User can create an institution

The system SHALL allow the user to create a new institution by providing a name. The name MUST be unique (case-insensitive). The institution is immediately available for use when creating or editing accounts.

#### Scenario: Successful institution creation
- **WHEN** the user submits the create institution form with a unique name
- **THEN** the institution is saved to the database and appears in the institution list

#### Scenario: Duplicate institution name is rejected
- **WHEN** the user submits the create institution form with a name that already exists (case-insensitive)
- **THEN** an inline validation error is shown and the institution is not saved

#### Scenario: Empty name is rejected
- **WHEN** the user submits the create institution form with a blank name
- **THEN** an inline validation error is shown and the institution is not saved

---

### Requirement: [F-04] User can edit an institution name

The system SHALL allow the user to rename an existing institution. The new name MUST be unique (case-insensitive, excluding the institution being renamed). All accounts linked to the institution SHALL reflect the updated name immediately.

#### Scenario: Successful institution rename
- **WHEN** the user submits the edit institution form with a valid new name
- **THEN** the institution record is updated and the new name is visible everywhere it is referenced

#### Scenario: Rename to existing name is rejected
- **WHEN** the user submits the edit institution form with a name that already belongs to a different institution
- **THEN** an inline validation error is shown and the institution is not saved

---

### Requirement: [F-04] User can delete an institution with confirmation

The system SHALL allow the user to delete an institution. A confirmation prompt MUST be shown before the deletion is carried out. An institution that is referenced by one or more accounts SHALL NOT be deletable; the UI MUST prevent or clearly communicate this.

#### Scenario: Delete confirmation shown
- **WHEN** the user triggers the delete action for an institution
- **THEN** a confirmation dialog is shown naming the institution and asking the user to confirm

#### Scenario: Confirmed deletion removes the institution
- **WHEN** the user confirms deletion of an institution with no linked accounts
- **THEN** the institution is removed from the database and no longer appears in any list

#### Scenario: Deletion cancelled leaves institution intact
- **WHEN** the user dismisses or cancels the confirmation dialog
- **THEN** the institution is not deleted

#### Scenario: Institution with linked accounts cannot be deleted
- **WHEN** the user triggers the delete action for an institution that has one or more linked accounts
- **THEN** the delete action is either disabled or an error message is shown explaining that the institution cannot be deleted while accounts reference it

---

### Requirement: [F-04] Institution management UI

The system SHALL provide institution management via a Dialog triggered from the accounts screen. The Dialog SHALL display a list of all institutions and provide controls to create, edit, and delete each one.

```
┌─────────────────────────────────────────────┐
│ Manage Institutions                      [X] │
├─────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────┐ │
│ │ Barclays                    [Edit] [Del] │ │
│ │ HSBC                        [Edit] [Del] │ │
│ │ Monzo                       [Edit] [Del] │ │
│ └─────────────────────────────────────────┘ │
│                                             │
│ [+ Add Institution]                         │
└─────────────────────────────────────────────┘
```

shadcn/ui components: `Dialog`, `DialogContent`, `Button`, inline `Input` for inline edit/create rows.

#### Scenario: Institutions list is shown in the dialog
- **WHEN** the user opens the institution management dialog
- **THEN** all existing institutions are listed with edit and delete controls beside each

#### Scenario: Add institution form appears inline
- **WHEN** the user clicks "Add Institution"
- **THEN** an inline input row appears for entering the new institution name with save and cancel controls
