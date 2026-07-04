# Haul Ledger Operator Guide

This guide is for the person setting up and quietly operating the hauling tracker for the business owner.

## What This App Is

Haul Ledger is a mobile web app/PWA for an owner and drivers.

- The owner sees jobs, expenses, gross profit, net profit, drivers, trucks, and driver tokens.
- Drivers only see their assigned jobs, expense entry, and time entry.
- Driver API routes do not send profit, gross, net, or per-load profit fields.

The app is designed to run on a normal website hosting plan with PHP and MySQL, such as Hostinger.

## Files That Go On The Website

Upload these live app files into the website folder, for example `public_html/hauling`:

```text
index.html
styles.css
app.js
manifest.webmanifest
service-worker.js
icon.svg
.htaccess
api/index.php
api/config.php
api/.htaccess
```

Do not upload these unless you specifically need them for setup/reference:

```text
schema.sql
README.md
OPERATOR_GUIDE.md
migrations/
api/config.example.php
```

The `.htaccess` file blocks `.sql` and `.md` files if they are accidentally uploaded, but it is still cleaner to leave setup files off the live site.

## First-Time Hostinger Setup

1. In Hostinger hPanel, create a MySQL database.
2. Suggested database name: `hauling_tracker`.
3. Suggested database user: `hauling_user`.
4. Hostinger may add a prefix, like `u123456789_hauling_tracker`. Use the full name Hostinger shows.
5. Open phpMyAdmin for that database.
6. Import `schema.sql`.
7. Confirm these tables appear:

```text
app_settings
drivers
trucks
jobs
expenses
time_entries
```

## Config File

Copy:

```text
api/config.example.php
```

Rename the copy to:

```text
api/config.php
```

Edit `api/config.php` with the exact database info from Hostinger:

```php
<?php
return [
    'db_host' => 'localhost',
    'db_name' => 'u123456789_hauling_tracker',
    'db_user' => 'u123456789_hauling_user',
    'db_pass' => 'DATABASE_PASSWORD_HERE',
];
```

Usually `db_host` stays `localhost` on Hostinger.

## First Owner Login

1. Open the app URL, such as `https://example.com/hauling/`.
2. The Owner card should show a create-PIN form.
3. Create a 6-digit owner PIN.
4. The app will open the owner dashboard.
5. After that, the owner logs in with that 6-digit PIN.

The owner PIN is stored in the database as a password hash, not plain text.

## Reset Owner PIN

Use this if the owner forgets the PIN or if you want to test first-time setup again.

In phpMyAdmin, run:

```sql
DELETE FROM app_settings
WHERE setting_key = 'owner_pin_hash';
```

Or import:

```text
migrations/002_reset_owner_pin.sql
```

Then reload the app. The Owner card will ask for a new 6-digit PIN.

## Driver Tokens

The owner dashboard has a Drivers section.

For each driver:

1. Add the driver by name.
2. Copy the generated token.
3. Give that token to the driver privately.
4. The driver uses the token in the Driver section of the app.

If a token is shared with the wrong person, use **New Token** on that driver. The old token stops working.

Starter tokens from the seed data:

```text
Ray Morgan: RAY-4821
Jess Carter: JESS-7394
Mike Allen: MIKE-1568
```

You can delete the starter rows from phpMyAdmin later, or simply stop using them.

## Deactivate Or Reactivate Drivers

If a driver quits or is fired, do not hard-delete them from the database. Deactivate them instead. This keeps old jobs, expenses, and time records intact for reports.

To deactivate a driver in phpMyAdmin:

```sql
UPDATE drivers
SET active = 0
WHERE name = 'Driver Name Here';
```

What this does:

- Keeps the driver in historical records.
- Stops their token from working.
- Removes them from active driver lists.
- Keeps old reports accurate.

To reactivate that driver later:

```sql
UPDATE drivers
SET active = 1
WHERE name = 'Driver Name Here';
```

## Deactivate Or Reactivate Trucks

If a truck is sold, retired, or was only demo data, do not hard-delete it if it has jobs or expenses tied to it. Deactivate it instead.

To deactivate a truck in phpMyAdmin:

```sql
UPDATE trucks
SET active = 0
WHERE name = 'Truck 12';
```

What this does:

- Keeps the truck in historical jobs and expense records.
- Removes it from active truck assignment lists.
- Keeps old reports accurate.

To reactivate that truck later:

```sql
UPDATE trucks
SET active = 1
WHERE name = 'Truck 12';
```

## Clear All Demo Data

If the starter drivers, trucks, jobs, expenses, and time entries are just demo data, clear them before entering real business data.

Run this in phpMyAdmin:

```sql
DELETE FROM time_entries;
DELETE FROM expenses;
DELETE FROM jobs;
DELETE FROM drivers;
DELETE FROM trucks;
```

Do not delete from `app_settings` unless you also want to reset the owner PIN.

## Daily Owner Workflow

1. Owner opens the app.
2. Logs in with the 6-digit PIN.
3. Selects the work date.
4. Adds or edits jobs.
5. Assigns each job to a driver and truck.
6. Confirms loads and profit per load.
7. Reviews expenses, net by job, driver, and truck.

Default profit per load in the frontend is `$250`, but the owner can change it per job.

## Daily Driver Workflow

1. Driver opens the app.
2. Enters their access token.
3. Selects the work date if needed.
4. Sees assigned jobs.
5. Adds fuel or other expenses.
6. Enters time.

Drivers do not see profit per load, gross profit, net profit, or owner summaries.

## iPhone Home Screen App

For owner and drivers:

1. Open the app URL in Safari.
2. Tap Share.
3. Tap Add to Home Screen.
4. Name it `Haul Ledger`.

This makes it feel like an app without App Store approval.

## Updating The Live App

When you change frontend files:

1. Upload the changed files.
2. If `app.js` or `styles.css` changes, update the version query in `index.html`, such as `app.js?v=3`.
3. Update `CACHE_NAME` in `service-worker.js`, such as `haul-ledger-web-v3`.
4. Ask users to close and reopen the app if they still see the old version.

For PHP changes:

1. Upload `api/index.php`.
2. Refresh the app.
3. If there is a database change, run the matching migration in phpMyAdmin.

## Backups

Before changing the database:

1. Open phpMyAdmin.
2. Select the hauling tracker database.
3. Use Export.
4. Save the SQL export somewhere safe.

Do this before major edits, migrations, or deleting test data.

## Common Problems

### App says config.php is missing

Make sure this file exists:

```text
api/config.php
```

Do not leave it named `config.example.php`.

### App says database connection failed

Check:

- Database name is the full Hostinger name, including prefix.
- Database user is the full Hostinger username, including prefix.
- Password is correct.
- `db_host` is `localhost`, unless Hostinger gave a different host.

### Owner setup does not appear

Check the `app_settings` table.

If `owner_pin_hash` exists, the app thinks setup is complete. Delete that row to reset setup.

### Driver token does not work

Check:

- Token was typed exactly, including the dash.
- Driver is active in the `drivers` table.
- Owner did not regenerate the token.

### Driver cannot see jobs

Check:

- Job date matches the date selected in the app.
- Job is assigned to that driver.
- Truck exists and is assigned.

## Important Security Note

This website version has the correct owner/driver data split at the API level. Driver API routes do not return profit fields.

Keep `api/config.php` private. Do not share database passwords or upload screenshots of that file.
