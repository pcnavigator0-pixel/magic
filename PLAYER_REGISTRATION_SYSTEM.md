# 🏀 Magic Initiative Rwanda Player Registration System

## System Overview

This document describes the **Player Registration System** - a secure two-stage enrollment process where coaches create player placeholders that are claimed by real users through registration code verification.

---

## Architecture

### Database Relationships

```
┌─────────────┐
│   players   │
├─────────────┤
│ id (uuid)   │ ◄────────┐
│ registration_code (unique) │    │
│ is_registered (bool)       │    │
│ full_name                  │    │
│ email                      │    │
│ auth_user_id (FK auth)     │    │
└─────────────┘             │
                            │
                    ┌───────┴───────┐
                    │               │
              ┌─────────────────┐   │
              │ portal_profiles │   │
              ├─────────────────┤   │
              │ id (FK auth)    │   │
              │ player_id (FK) ─┴───┘
              │ full_name       │
              │ email           │
              │ role            │
              └─────────────────┘
```

### Key Tables

#### Players Table
| Field | Type | Notes |
|-------|------|-------|
| `id` | UUID | Primary key |
| `registration_code` | TEXT (UNIQUE) | 8-char code generated on creation |
| `is_registered` | BOOLEAN | `false` until player completes signup |
| `full_name` | TEXT | Coach name → Real name on registration |
| `jersey_number` | INTEGER | Coach assigned |
| `position` | TEXT | Coach assigned |
| `email` | TEXT (UNIQUE) | Set during player registration |
| `auth_user_id` | UUID FK | Set during player registration |
| `status` | TEXT | active/injured/inactive |
| `created_at` | TIMESTAMP | Auto-set |
| `updated_at` | TIMESTAMP | Auto-updated |

#### Portal Profiles Table (Updated)
| Field | Type | Notes |
|-------|------|-------|
| `id` | UUID FK | References auth.users |
| `player_id` | UUID FK | **NEW** - Links to players.id |
| `full_name` | TEXT | Real user name |
| `email` | TEXT (UNIQUE) | User email |
| `role` | TEXT | "player" or "coach" |
| `created_at` | TIMESTAMP | Auto-set |

---

## Registration Flow

### 📝 Stage 1: Coach Creates Player (Dashboard)

**Location:** Coach Dashboard → Players Panel → "Add Player"

```
Coach fills form:
├─ Full Name: "John Smith" (placeholder)
├─ Jersey Number: 23
├─ Position: "Shooting Guard"
├─ Height: "6'5"
└─ Status: "active"
       │
       ▼
insertPlayer() called
├─ Generates: registration_code = "AB12CD34" (unique)
├─ Sets: is_registered = false
└─ Saves to database
       │
       ▼
Coach sees in table:
├─ Name: "John Smith"
├─ Code: AB12CD34
├─ Status: (empty - not registered yet)
└─ Can copy code to share with player
```

### 👤 Stage 2: Player Registers Account (Signup Page)

**Location:** Registration/Signup Flow

```
Player enters:
├─ Real Full Name: "John Smith Jr."
├─ Email: "john.smith@email.com"
└─ Registration Code: "AB12CD34"
       │
       ▼
verifyRegistrationCode("AB12CD34")
├─ Check: Code exists? ✓
├─ Check: is_registered = false? ✓
└─ Show: Position "Shooting Guard", Jersey "23"
       │
       ▼
Player creates auth account (Supabase Auth)
       │
       ▼
completePlayerRegistration():
├─ Update players record:
│  ├─ full_name → "John Smith Jr." (real name)
│  ├─ email → "john.smith@email.com"
│  ├─ auth_user_id → {UUID from auth}
│  └─ is_registered → true
│
├─ Create portal_profile:
│  ├─ id = auth_user_id
│  ├─ player_id = players.id (FOREIGN KEY!)
│  ├─ full_name = "John Smith Jr."
│  ├─ email = "john.smith@email.com"
│  └─ role = "player"
│
└─ Player can now login to dashboard
       │
       ▼
Coach sees in table:
├─ Name: "John Smith Jr." (updated)
├─ Code: AB12CD34
└─ Status: ✓ Registered (green badge)
```

---

## API Functions

### In `lib/magic-data.ts`

#### `generateRegistrationCode(): string`
Generates a unique 8-character alphanumeric code.

```typescript
// Output example: "AB12CD34"
const code = generateRegistrationCode();
```

---

#### `verifyRegistrationCode(code: string, accessToken?): Promise<Player | null>`
Checks if a registration code is valid and unclaimed.

```typescript
const player = await verifyRegistrationCode("AB12CD34");

// Returns player object if valid:
// {
//   id: "uuid-123",
//   full_name: "John Smith",
//   jersey_number: 23,
//   position: "Shooting Guard",
//   registration_code: "AB12CD34",
//   is_registered: false,
//   ...
// }

// Returns null if invalid or already registered
```

---

#### `getPlayerByRegistrationCode(code: string, accessToken?): Promise<Player | null>`
Retrieves player details by registration code (shows coach-assigned info during signup).

```typescript
const player = await getPlayerByRegistrationCode("AB12CD34");
// Use to display: "You're registered as Shooting Guard #23"
```

---

#### `completePlayerRegistration(code, realFullName, email, authUserId, accessToken?): Promise<Player>`
Finalizes player registration - updates player record and creates portal profile.

**Called during player signup flow:**

```typescript
try {
  const registered = await completePlayerRegistration(
    "AB12CD34",                    // Registration code from player
    "John Smith Jr.",              // Real name from form
    "john.smith@email.com",        // Email from form
    authUserId,                    // UUID from auth.users
    accessToken                    // Optional auth token
  );
  
  console.log(registered.is_registered); // true
  // Portal profile now created with player_id FK
  
} catch (error) {
  // "Invalid registration code"
  // "This registration code has already been used"
  // "Failed to update player profile"
}
```

---

#### `insertPlayer(payload): Promise<Player[]>` (Updated)
Creates a new player record with auto-generated code.

```typescript
const [newPlayer] = await insertPlayer({
  full_name: "Pending Name",
  jersey_number: 5,
  position: "Point Guard",
  height: "6'2",
  bio: null,
  status: "active",
  // registration_code and is_registered auto-set!
});

// Returns player with:
// registration_code: "ABC12345"
// is_registered: false
```

---

## UI Components

### Coach Dashboard - Players Panel

**Displays:**
- Player name (coach-provided initially)
- Jersey number
- Position
- Height
- **Registration Code** (monospace, highlighted)
- **Registration Status** (✓ Registered badge once claimed)

**Actions:**
- Edit (pre-registration only)
- Delete
- Copy registration code

```
| Name | No. | Position | Height | Registration Code | Status | Actions |
|------|-----|----------|--------|------------------|--------|---------|
| John Smith | 23 | SG | 6'5" | AB12CD34 | ✓ Registered | ... |
| Jane Doe | 15 | PG | 5'10" | CD34EF56 | | ... |
```

---

## Security Considerations

### ✅ What This System Prevents

1. **Unauthorized player accounts** - Code required to claim account
2. **Email spoofing** - Player provides email at signup
3. **Duplicate registrations** - `is_registered` flag prevents re-use
4. **Coach impersonation** - Player's real name confirmed at signup

### ⚠️ Recommendations

1. **Share code securely** - Email/QR/In-person (not SMS for sensitive data)
2. **Code expiration** (Optional future enhancement):
   ```sql
   ALTER TABLE players ADD COLUMN code_expires_at TIMESTAMP;
   ```

3. **Audit logging** (Optional future enhancement):
   - Log when code was generated
   - Log when code was claimed
   - Log account creation timestamp

4. **Rate limiting** - Limit registration attempts by IP

---

## Example Scenarios

### Scenario 1: New Season Roster

```
1. Coach opens Magic Initiative Rwanda admin dashboard
2. Coach → Players panel → Add Player
3. Enters 15 players for new season
4. System generates 15 unique codes
5. Coach screenshots/exports codes
6. Coach sends roster to players (via email, document, etc.)
7. Player receives code "AB12CD34"
8. Player goes to signup page
9. Player enters: Name, Email, Code
10. Account created, portal_profile linked
11. Player logs in to see their roster position ✓
12. Coach sees "✓ Registered" badge next to name
```

### Scenario 2: Player Transfer

```
1. New player joins team mid-season
2. Coach adds player: "New Member" jersey #7 PG
3. Code generated: "XY78ZA90"
4. Coach tells player: "Your registration code is XY78ZA90"
5. Player registers with code
6. Portal_profile created linking to this player record
7. Player can now view match stats, roster, notifications
```

### Scenario 3: Coach Updates Player Info

```
Before Registration:
- players.full_name = "Pending Player"
- players.is_registered = false
- Coach can edit details

After Registration:
- players.full_name = "Real Name" (from signup)
- players.email = "real@email.com"
- players.is_registered = true
- players.auth_user_id = {auth UUID}
- Coach can still edit, but real name is now from registered user
```

---

## Implementation Checklist

- [x] Add `registration_code` column to players table
- [x] Add `is_registered` flag to players table
- [x] Add `player_id` FK to portal_profiles table
- [x] Create `generateRegistrationCode()` function
- [x] Create `verifyRegistrationCode()` function
- [x] Create `completePlayerRegistration()` function
- [x] Update `insertPlayer()` to auto-generate code
- [x] Update coach dashboard to display registration code
- [x] Add registration status badge to player table
- [ ] **Create signup form that accepts registration code**
- [ ] **Link signup flow to `completePlayerRegistration()`**
- [ ] **Add portal profile creation to registration flow**
- [ ] Test: Coach creates player → Player registers → Links work
- [ ] Test: Invalid code → Error message
- [ ] Test: Re-use code → Error message

---

## Future Enhancements

1. **Code expiration** - Auto-invalidate codes after 30 days
2. **SMS/Email delivery** - Send codes automatically to coaches
3. **QR codes** - Generate QR code containing registration link
4. **Bulk import** - Coach uploads CSV, system generates codes
5. **Code history** - View when each code was created/claimed
6. **Permission changes** - Only registered players can access full features
7. **Profile completion** - Player photo upload on registration

---

## Testing

```typescript
// Test: Generate codes
const code1 = generateRegistrationCode(); // "AB12CD34"
const code2 = generateRegistrationCode(); // "CD56EF78" (different)

// Test: Valid registration
const player = await verifyRegistrationCode("AB12CD34"); // ✓ Returns player
await completePlayerRegistration("AB12CD34", "John Doe", "john@email.com", authId);
const player2 = await verifyRegistrationCode("AB12CD34"); // null (already used)

// Test: Invalid code
const invalid = await verifyRegistrationCode("INVALID"); // null

// Test: Player can login after registration
// portal_profile.player_id should match players.id
```

---

## Support

For questions about this system, refer to:
- `lib/magic-data.ts` - Implementation
- `AGENTS.md` - Deployment notes
- Coach Dashboard Players Panel - UI reference
