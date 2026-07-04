<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
session_set_cookie_params([
    'httponly' => true,
    'samesite' => 'Lax',
    'secure' => !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off',
]);
session_start();

try {
    $action = $_GET['action'] ?? '';
    $input = read_json();
    $pdo = db();

    switch ($action) {
        case 'setup_status':
            setup_status($pdo);
            break;
        case 'owner_setup':
            owner_setup($pdo, $input);
            break;
        case 'owner_login':
            owner_login($pdo, $input);
            break;
        case 'driver_login':
            driver_login($pdo, $input);
            break;
        case 'logout':
            session_destroy();
            ok(['logged_out' => true]);
            break;
        case 'owner_day':
            require_owner();
            owner_day($pdo);
            break;
        case 'owner_add_driver':
            require_owner();
            owner_add_driver($pdo, $input);
            break;
        case 'owner_regenerate_driver_token':
            require_owner();
            owner_regenerate_driver_token($pdo, $input);
            break;
        case 'owner_add_truck':
            require_owner();
            owner_add_truck($pdo, $input);
            break;
        case 'owner_save_job':
            require_owner();
            owner_save_job($pdo, $input);
            break;
        case 'driver_day':
            require_driver();
            driver_day($pdo);
            break;
        case 'driver_add_expense':
            require_driver();
            driver_add_expense($pdo, $input);
            break;
        case 'driver_add_time':
            require_driver();
            driver_add_time($pdo, $input);
            break;
        default:
            fail('Unknown action', 404);
    }
} catch (Throwable $error) {
    fail($error->getMessage(), 500);
}

function config(): array
{
    $path = __DIR__ . '/config.php';
    if (!file_exists($path)) {
        fail('Missing api/config.php. Copy config.example.php and add your database settings.', 500);
    }
    return require $path;
}

function db(): PDO
{
    $config = config();
    $dsn = sprintf(
        'mysql:host=%s;dbname=%s;charset=utf8mb4',
        $config['db_host'],
        $config['db_name']
    );
    return new PDO($dsn, $config['db_user'], $config['db_pass'], [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]);
}

function setup_status(PDO $pdo): void
{
    ok(['owner_pin_set' => owner_pin_set($pdo)]);
}

function owner_setup(PDO $pdo, array $input): void
{
    if (owner_pin_set($pdo)) {
        fail('Owner PIN is already set', 409);
    }

    $pin = trim((string) ($input['pin'] ?? ''));
    $confirm = trim((string) ($input['pin_confirm'] ?? ''));
    if (!preg_match('/^\d{6}$/', $pin)) fail('PIN must be exactly 6 digits', 422);
    if ($pin !== $confirm) fail('PINs do not match', 422);

    $hash = password_hash($pin, PASSWORD_DEFAULT);
    $stmt = $pdo->prepare('INSERT INTO app_settings (setting_key, setting_value) VALUES (?, ?)');
    $stmt->execute(['owner_pin_hash', $hash]);

    $_SESSION['role'] = 'owner';
    unset($_SESSION['driver_id']);
    ok(['role' => 'owner']);
}

function owner_login(PDO $pdo, array $input): void
{
    $hash = owner_pin_hash($pdo);
    if (!$hash) {
        fail('Create the owner PIN first', 409);
    }

    if (!password_verify((string) ($input['pin'] ?? ''), $hash)) {
        fail('Wrong owner PIN', 401);
    }

    $_SESSION['role'] = 'owner';
    unset($_SESSION['driver_id']);
    ok(['role' => 'owner']);
}

function owner_pin_set(PDO $pdo): bool
{
    return owner_pin_hash($pdo) !== null;
}

function owner_pin_hash(PDO $pdo): ?string
{
    $stmt = $pdo->prepare('SELECT setting_value FROM app_settings WHERE setting_key = ? LIMIT 1');
    $stmt->execute(['owner_pin_hash']);
    $value = $stmt->fetchColumn();
    return $value === false ? null : (string) $value;
}

function driver_login(PDO $pdo, array $input): void
{
    $token = strtoupper(trim((string) ($input['token'] ?? '')));
    $stmt = $pdo->prepare('SELECT id, name FROM drivers WHERE access_token = ? AND active = 1 LIMIT 1');
    $stmt->execute([$token]);
    $driver = $stmt->fetch();
    if (!$driver) {
        fail('Token not found', 401);
    }

    $_SESSION['role'] = 'driver';
    $_SESSION['driver_id'] = (int) $driver['id'];
    ok(['driver' => $driver]);
}

function owner_day(PDO $pdo): void
{
    $date = valid_date($_GET['date'] ?? date('Y-m-d'));

    $drivers = $pdo->query('SELECT id, name, access_token FROM drivers WHERE active = 1 ORDER BY name')->fetchAll();
    $trucks = $pdo->query('SELECT id, name FROM trucks WHERE active = 1 ORDER BY name')->fetchAll();

    $jobs = fetch_all($pdo, '
        SELECT j.id, j.work_date, j.name, j.route, j.driver_id, d.name AS driver_name,
               j.truck_id, t.name AS truck_name, j.loads, j.profit_per_load
        FROM jobs j
        JOIN drivers d ON d.id = j.driver_id
        JOIN trucks t ON t.id = j.truck_id
        WHERE j.work_date = ?
        ORDER BY j.id DESC
    ', [$date]);

    $expenses = fetch_all($pdo, '
        SELECT e.id, e.job_id, e.driver_id, e.truck_id, e.work_date, e.type, e.amount, e.note,
               j.name AS job_name, d.name AS driver_name, t.name AS truck_name
        FROM expenses e
        JOIN jobs j ON j.id = e.job_id
        JOIN drivers d ON d.id = e.driver_id
        JOIN trucks t ON t.id = e.truck_id
        WHERE e.work_date = ?
        ORDER BY e.id DESC
    ', [$date]);

    $timeEntries = fetch_all($pdo, '
        SELECT id, job_id, driver_id, work_date, TIME_FORMAT(start_time, "%H:%i") AS start_time,
               TIME_FORMAT(end_time, "%H:%i") AS end_time
        FROM time_entries
        WHERE work_date = ?
        ORDER BY id DESC
    ', [$date]);

    ok(compact('drivers', 'trucks', 'jobs', 'expenses', 'timeEntries'));
}

function owner_add_driver(PDO $pdo, array $input): void
{
    $name = trim((string) ($input['name'] ?? ''));
    if ($name === '') fail('Driver name is required', 422);

    $token = unique_token($pdo, $name);
    $stmt = $pdo->prepare('INSERT INTO drivers (name, access_token) VALUES (?, ?)');
    $stmt->execute([$name, $token]);
    ok(['driver' => ['id' => (int) $pdo->lastInsertId(), 'name' => $name, 'access_token' => $token]]);
}

function owner_regenerate_driver_token(PDO $pdo, array $input): void
{
    $driverId = positive_int($input['driver_id'] ?? null, 'Driver');
    $stmt = $pdo->prepare('SELECT id, name FROM drivers WHERE id = ? AND active = 1');
    $stmt->execute([$driverId]);
    $driver = $stmt->fetch();
    if (!$driver) fail('Driver not found', 404);

    $token = unique_token($pdo, $driver['name']);
    $stmt = $pdo->prepare('UPDATE drivers SET access_token = ? WHERE id = ?');
    $stmt->execute([$token, $driverId]);
    ok(['driver' => ['id' => $driverId, 'name' => $driver['name'], 'access_token' => $token]]);
}

function owner_add_truck(PDO $pdo, array $input): void
{
    $name = trim((string) ($input['name'] ?? ''));
    if ($name === '') fail('Truck name is required', 422);

    $stmt = $pdo->prepare('INSERT INTO trucks (name) VALUES (?)');
    $stmt->execute([$name]);
    ok(['truck' => ['id' => (int) $pdo->lastInsertId(), 'name' => $name]]);
}

function owner_save_job(PDO $pdo, array $input): void
{
    $id = isset($input['id']) && $input['id'] !== '' ? positive_int($input['id'], 'Job') : null;
    $date = valid_date($input['work_date'] ?? date('Y-m-d'));
    $name = trim((string) ($input['name'] ?? ''));
    $route = trim((string) ($input['route'] ?? ''));
    $driverId = positive_int($input['driver_id'] ?? null, 'Driver');
    $truckId = positive_int($input['truck_id'] ?? null, 'Truck');
    $loads = positive_int($input['loads'] ?? null, 'Loads');
    $profitPerLoad = valid_money($input['profit_per_load'] ?? null, 'Profit per load');
    if ($name === '') fail('Job name is required', 422);

    if ($id) {
        $stmt = $pdo->prepare('
            UPDATE jobs
            SET work_date = ?, name = ?, route = ?, driver_id = ?, truck_id = ?, loads = ?, profit_per_load = ?
            WHERE id = ?
        ');
        $stmt->execute([$date, $name, $route, $driverId, $truckId, $loads, $profitPerLoad, $id]);
        ok(['id' => $id]);
    }

    $stmt = $pdo->prepare('
        INSERT INTO jobs (work_date, name, route, driver_id, truck_id, loads, profit_per_load)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    ');
    $stmt->execute([$date, $name, $route, $driverId, $truckId, $loads, $profitPerLoad]);
    ok(['id' => (int) $pdo->lastInsertId()]);
}

function driver_day(PDO $pdo): void
{
    $date = valid_date($_GET['date'] ?? date('Y-m-d'));
    $driverId = (int) $_SESSION['driver_id'];

    $stmt = $pdo->prepare('SELECT id, name FROM drivers WHERE id = ? AND active = 1');
    $stmt->execute([$driverId]);
    $driver = $stmt->fetch();
    if (!$driver) fail('Driver not found', 404);

    // No profit fields are selected here. Driver devices never receive profit data from this endpoint.
    $jobs = fetch_all($pdo, '
        SELECT j.id, j.work_date, j.name, j.route, j.driver_id, j.truck_id, t.name AS truck_name, j.loads
        FROM jobs j
        JOIN trucks t ON t.id = j.truck_id
        WHERE j.work_date = ? AND j.driver_id = ?
        ORDER BY j.id DESC
    ', [$date, $driverId]);

    $expenses = fetch_all($pdo, '
        SELECT e.id, e.job_id, e.driver_id, e.truck_id, e.work_date, e.type, e.amount, e.note,
               j.name AS job_name, t.name AS truck_name
        FROM expenses e
        JOIN jobs j ON j.id = e.job_id
        JOIN trucks t ON t.id = e.truck_id
        WHERE e.work_date = ? AND e.driver_id = ?
        ORDER BY e.id DESC
    ', [$date, $driverId]);

    $timeEntries = fetch_all($pdo, '
        SELECT id, job_id, driver_id, work_date, TIME_FORMAT(start_time, "%H:%i") AS start_time,
               TIME_FORMAT(end_time, "%H:%i") AS end_time
        FROM time_entries
        WHERE work_date = ? AND driver_id = ?
        ORDER BY id DESC
    ', [$date, $driverId]);

    ok(compact('driver', 'jobs', 'expenses', 'timeEntries'));
}

function driver_add_expense(PDO $pdo, array $input): void
{
    $driverId = (int) $_SESSION['driver_id'];
    $job = driver_job($pdo, positive_int($input['job_id'] ?? null, 'Job'), $driverId);
    $type = trim((string) ($input['type'] ?? ''));
    $amount = valid_money($input['amount'] ?? null, 'Amount');
    $note = trim((string) ($input['note'] ?? ''));
    if ($type === '') fail('Expense type is required', 422);

    $stmt = $pdo->prepare('
        INSERT INTO expenses (job_id, driver_id, truck_id, work_date, type, amount, note)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    ');
    $stmt->execute([$job['id'], $driverId, $job['truck_id'], $job['work_date'], $type, $amount, $note]);
    ok(['id' => (int) $pdo->lastInsertId()]);
}

function driver_add_time(PDO $pdo, array $input): void
{
    $driverId = (int) $_SESSION['driver_id'];
    $job = driver_job($pdo, positive_int($input['job_id'] ?? null, 'Job'), $driverId);
    $start = valid_time($input['start_time'] ?? '', 'Start time');
    $end = valid_time($input['end_time'] ?? '', 'End time');

    $stmt = $pdo->prepare('
        INSERT INTO time_entries (job_id, driver_id, work_date, start_time, end_time)
        VALUES (?, ?, ?, ?, ?)
    ');
    $stmt->execute([$job['id'], $driverId, $job['work_date'], $start, $end]);
    ok(['id' => (int) $pdo->lastInsertId()]);
}

function driver_job(PDO $pdo, int $jobId, int $driverId): array
{
    $stmt = $pdo->prepare('SELECT id, driver_id, truck_id, work_date FROM jobs WHERE id = ? AND driver_id = ?');
    $stmt->execute([$jobId, $driverId]);
    $job = $stmt->fetch();
    if (!$job) fail('Assigned job not found', 404);
    return $job;
}

function unique_token(PDO $pdo, string $name): string
{
    do {
        $prefix = strtoupper(substr(preg_replace('/[^a-zA-Z]/', '', $name) ?: 'DRVR', 0, 4));
        $prefix = str_pad($prefix, 4, 'X');
        $token = $prefix . '-' . random_int(1000, 9999);
        $stmt = $pdo->prepare('SELECT COUNT(*) FROM drivers WHERE access_token = ?');
        $stmt->execute([$token]);
    } while ((int) $stmt->fetchColumn() > 0);

    return $token;
}

function fetch_all(PDO $pdo, string $sql, array $params = []): array
{
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    return $stmt->fetchAll();
}

function read_json(): array
{
    $raw = file_get_contents('php://input');
    if ($raw === '' || $raw === false) return [];
    $decoded = json_decode($raw, true);
    return is_array($decoded) ? $decoded : [];
}

function require_owner(): void
{
    if (($_SESSION['role'] ?? '') !== 'owner') fail('Owner login required', 401);
}

function require_driver(): void
{
    if (($_SESSION['role'] ?? '') !== 'driver' || empty($_SESSION['driver_id'])) fail('Driver login required', 401);
}

function valid_date(string $date): string
{
    if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) fail('Invalid date', 422);
    return $date;
}

function valid_time(string $time, string $label): string
{
    if (!preg_match('/^\d{2}:\d{2}$/', $time)) fail($label . ' is invalid', 422);
    return $time . ':00';
}

function positive_int($value, string $label): int
{
    $int = filter_var($value, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]);
    if (!$int) fail($label . ' is required', 422);
    return (int) $int;
}

function valid_money($value, string $label): string
{
    if (!is_numeric($value) || (float) $value < 0) fail($label . ' is invalid', 422);
    return number_format((float) $value, 2, '.', '');
}

function ok(array $data): void
{
    echo json_encode(['ok' => true, 'data' => $data]);
    exit;
}

function fail(string $message, int $status = 400): void
{
    http_response_code($status);
    echo json_encode(['ok' => false, 'error' => $message]);
    exit;
}
