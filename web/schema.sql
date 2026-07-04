CREATE TABLE app_settings (
  setting_key VARCHAR(80) NOT NULL,
  setting_value TEXT NOT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (setting_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE drivers (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(80) NOT NULL,
  access_token VARCHAR(40) NOT NULL,
  active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY drivers_access_token_unique (access_token)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE trucks (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(80) NOT NULL,
  active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE jobs (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  work_date DATE NOT NULL,
  name VARCHAR(100) NOT NULL,
  route VARCHAR(140) NULL,
  driver_id INT UNSIGNED NOT NULL,
  truck_id INT UNSIGNED NOT NULL,
  loads INT UNSIGNED NOT NULL DEFAULT 1,
  profit_per_load DECIMAL(10,2) NOT NULL DEFAULT 250.00,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY jobs_work_date_idx (work_date),
  KEY jobs_driver_idx (driver_id),
  KEY jobs_truck_idx (truck_id),
  CONSTRAINT jobs_driver_fk FOREIGN KEY (driver_id) REFERENCES drivers(id),
  CONSTRAINT jobs_truck_fk FOREIGN KEY (truck_id) REFERENCES trucks(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE expenses (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  job_id INT UNSIGNED NOT NULL,
  driver_id INT UNSIGNED NOT NULL,
  truck_id INT UNSIGNED NOT NULL,
  work_date DATE NOT NULL,
  type VARCHAR(40) NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  note VARCHAR(160) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY expenses_work_date_idx (work_date),
  KEY expenses_job_idx (job_id),
  KEY expenses_driver_idx (driver_id),
  CONSTRAINT expenses_job_fk FOREIGN KEY (job_id) REFERENCES jobs(id),
  CONSTRAINT expenses_driver_fk FOREIGN KEY (driver_id) REFERENCES drivers(id),
  CONSTRAINT expenses_truck_fk FOREIGN KEY (truck_id) REFERENCES trucks(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE time_entries (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  job_id INT UNSIGNED NOT NULL,
  driver_id INT UNSIGNED NOT NULL,
  work_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY time_entries_work_date_idx (work_date),
  KEY time_entries_job_idx (job_id),
  KEY time_entries_driver_idx (driver_id),
  CONSTRAINT time_entries_job_fk FOREIGN KEY (job_id) REFERENCES jobs(id),
  CONSTRAINT time_entries_driver_fk FOREIGN KEY (driver_id) REFERENCES drivers(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO drivers (name, access_token) VALUES
  ('Ray Morgan', 'RAY-4821'),
  ('Jess Carter', 'JESS-7394'),
  ('Mike Allen', 'MIKE-1568');

INSERT INTO trucks (name) VALUES
  ('Truck 12'),
  ('Truck 18'),
  ('Truck 22');

INSERT INTO jobs (work_date, name, route, driver_id, truck_id, loads, profit_per_load) VALUES
  (CURRENT_DATE, 'Rock - North pad', 'Bluegrass Quarry to North pad', 1, 1, 4, 250.00),
  (CURRENT_DATE, 'Fill dirt - Lot 8', 'Yard to Lot 8', 2, 2, 3, 250.00);

INSERT INTO expenses (job_id, driver_id, truck_id, work_date, type, amount, note) VALUES
  (1, 1, 1, CURRENT_DATE, 'Fuel', 200.00, 'Morning fill');

INSERT INTO time_entries (job_id, driver_id, work_date, start_time, end_time) VALUES
  (1, 1, CURRENT_DATE, '07:00:00', '15:30:00');
