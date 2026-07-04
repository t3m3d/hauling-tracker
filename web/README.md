# Haul Ledger Web App

This folder is the Hostinger-ready version of the hauling tracker.

For the full behind-the-scenes setup and operating instructions, read `OPERATOR_GUIDE.md`.

## Upload

Upload the contents of this `web` folder to a folder on your site, for example:

- `public_html/hauling`
- or a subdomain document root like `app.yourdomain.com`

The included `.htaccess` file blocks direct public access to this README and `schema.sql` on Apache/Hostinger.

## Database

1. In Hostinger hPanel, create a MySQL database and user.
2. Open phpMyAdmin.
3. Import `schema.sql`.
4. Copy `api/config.example.php` to `api/config.php`.
5. Put your Hostinger database name, user, and password in `api/config.php`.

## First Login

Owner:

- The first time you open the app, the Owner section asks you to create a 6-digit PIN.
- After that, the normal owner login uses that PIN.
- To test setup again or reset the owner PIN, import `migrations/002_reset_owner_pin.sql` in phpMyAdmin. The next app load will show the create-PIN form again.

Seed driver tokens:

- Ray Morgan: `RAY-4821`
- Jess Carter: `JESS-7394`
- Mike Allen: `MIKE-1568`

## Privacy Boundary

Owner API routes return profit and net data.

Driver API routes do not select or return `profit_per_load`, gross, or net fields. Driver phones only receive assigned job details, loads, truck, expenses, and time.

## iPhone Install

Open the app URL in Safari, then tap Share > Add to Home Screen.
