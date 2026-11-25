-- HouseTrack: Rental Property Management System

DROP DATABASE IF EXISTS housetrack;
CREATE DATABASE housetrack CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE housetrack;

-- 1. users
CREATE TABLE users (
  user_id        INT UNSIGNED NOT NULL AUTO_INCREMENT,
  full_name      VARCHAR(100) NOT NULL,
  email          VARCHAR(120) NOT NULL,
  password_hash  VARCHAR(255) NOT NULL,
  role           ENUM('Owner','System Administrator','Tenant') NOT NULL,
  status         ENUM('Active','Inactive') NOT NULL DEFAULT 'Active',
  created_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id),
  UNIQUE KEY uq_users_email (email)
) ENGINE=InnoDB;

-- 2. tenants (profile details for users with role = Tenant)
CREATE TABLE tenants (
  tenant_id                 INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id                   INT UNSIGNED NOT NULL,
  contact_number            VARCHAR(20) NOT NULL,
  emergency_contact_name    VARCHAR(100) NULL,
  emergency_contact_number  VARCHAR(20) NULL,
  valid_id_type             VARCHAR(50) NULL,
  created_at                TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (tenant_id),
  UNIQUE KEY uq_tenants_user (user_id),
  CONSTRAINT fk_tenants_user FOREIGN KEY (user_id) REFERENCES users(user_id)
    ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;

-- 3. properties
CREATE TABLE properties (
  property_id  INT UNSIGNED NOT NULL AUTO_INCREMENT,
  owner_id     INT UNSIGNED NOT NULL,
  name         VARCHAR(100) NOT NULL,
  address      VARCHAR(255) NOT NULL,
  description  TEXT NULL,
  created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (property_id),
  KEY idx_properties_owner (owner_id),
  CONSTRAINT fk_properties_owner FOREIGN KEY (owner_id) REFERENCES users(user_id)
    ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;

-- 4. units
CREATE TABLE units (
  unit_id       INT UNSIGNED NOT NULL AUTO_INCREMENT,
  property_id   INT UNSIGNED NOT NULL,
  unit_name     VARCHAR(50) NOT NULL,
  monthly_rent  DECIMAL(10,2) NOT NULL,
  status        ENUM('Vacant','Occupied','Under Repair') NOT NULL DEFAULT 'Vacant',
  description   VARCHAR(255) NULL,
  PRIMARY KEY (unit_id),
  UNIQUE KEY uq_units_property_name (property_id, unit_name),
  CONSTRAINT fk_units_property FOREIGN KEY (property_id) REFERENCES properties(property_id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT chk_units_rent CHECK (monthly_rent >= 0)
) ENGINE=InnoDB;

-- 5. rental_contracts
CREATE TABLE rental_contracts (
  contract_id       INT UNSIGNED NOT NULL AUTO_INCREMENT,
  tenant_id         INT UNSIGNED NOT NULL,
  unit_id           INT UNSIGNED NOT NULL,
  start_date        DATE NOT NULL,
  end_date          DATE NOT NULL,
  monthly_rent      DECIMAL(10,2) NOT NULL,
  security_deposit  DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  due_day           TINYINT UNSIGNED NOT NULL DEFAULT 5,
  status            ENUM('Active','Ended','Terminated') NOT NULL DEFAULT 'Active',
  created_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (contract_id),
  KEY idx_contracts_tenant (tenant_id),
  KEY idx_contracts_unit (unit_id),
  CONSTRAINT fk_contracts_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(tenant_id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_contracts_unit FOREIGN KEY (unit_id) REFERENCES units(unit_id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT chk_contracts_dates CHECK (end_date > start_date),
  CONSTRAINT chk_contracts_dueday CHECK (due_day BETWEEN 1 AND 28)
) ENGINE=InnoDB;

-- 6. dues
CREATE TABLE dues (
  due_id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  contract_id    INT UNSIGNED NOT NULL,
  description    VARCHAR(150) NOT NULL,
  billing_month  DATE NOT NULL,
  amount         DECIMAL(10,2) NOT NULL,
  due_date       DATE NOT NULL,
  status         ENUM('Unpaid','Partially Paid','Paid','Overdue') NOT NULL DEFAULT 'Unpaid',
  created_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (due_id),
  KEY idx_dues_contract (contract_id),
  KEY idx_dues_status_date (status, due_date),
  CONSTRAINT fk_dues_contract FOREIGN KEY (contract_id) REFERENCES rental_contracts(contract_id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT chk_dues_amount CHECK (amount > 0)
) ENGINE=InnoDB;

-- 7. payments
CREATE TABLE payments (
  payment_id        INT UNSIGNED NOT NULL AUTO_INCREMENT,
  due_id            INT UNSIGNED NOT NULL,
  amount            DECIMAL(10,2) NOT NULL,
  payment_date      DATE NOT NULL,
  method            ENUM('Cash','GCash','Bank Transfer') NOT NULL,
  reference_number  VARCHAR(60) NULL,
  proof_path        VARCHAR(255) NULL,
  status            ENUM('Pending','Verified','Rejected') NOT NULL DEFAULT 'Pending',
  recorded_by       INT UNSIGNED NOT NULL,
  created_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (payment_id),
  KEY idx_payments_due (due_id),
  KEY idx_payments_recorded_by (recorded_by),
  CONSTRAINT fk_payments_due FOREIGN KEY (due_id) REFERENCES dues(due_id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_payments_recorded_by FOREIGN KEY (recorded_by) REFERENCES users(user_id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT chk_payments_amount CHECK (amount > 0)
) ENGINE=InnoDB;

-- 8. receipts
CREATE TABLE receipts (
  receipt_id      INT UNSIGNED NOT NULL AUTO_INCREMENT,
  payment_id      INT UNSIGNED NOT NULL,
  receipt_number  VARCHAR(30) NOT NULL,
  issued_by       INT UNSIGNED NOT NULL,
  issued_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (receipt_id),
  UNIQUE KEY uq_receipts_payment (payment_id),
  UNIQUE KEY uq_receipts_number (receipt_number),
  CONSTRAINT fk_receipts_payment FOREIGN KEY (payment_id) REFERENCES payments(payment_id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_receipts_issued_by FOREIGN KEY (issued_by) REFERENCES users(user_id)
    ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;

-- 9. repair_requests
CREATE TABLE repair_requests (
  request_id        INT UNSIGNED NOT NULL AUTO_INCREMENT,
  tenant_id         INT UNSIGNED NOT NULL,
  unit_id           INT UNSIGNED NOT NULL,
  title             VARCHAR(120) NOT NULL,
  description       TEXT NOT NULL,
  priority          ENUM('Low','Medium','High','Urgent') NOT NULL DEFAULT 'Medium',
  status            ENUM('Pending','In Progress','Resolved','Rejected') NOT NULL DEFAULT 'Pending',
  photo_path        VARCHAR(255) NULL,
  resolution_notes  TEXT NULL,
  created_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  resolved_at       DATETIME NULL,
  PRIMARY KEY (request_id),
  KEY idx_repairs_tenant (tenant_id),
  KEY idx_repairs_unit (unit_id),
  KEY idx_repairs_status (status),
  CONSTRAINT fk_repairs_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(tenant_id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_repairs_unit FOREIGN KEY (unit_id) REFERENCES units(unit_id)
    ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;

-- 10. audit_logs
CREATE TABLE audit_logs (
  log_id       BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id      INT UNSIGNED NULL,
  action       VARCHAR(60) NOT NULL,
  entity_type  VARCHAR(50) NOT NULL,
  entity_id    INT UNSIGNED NULL,
  details      TEXT NULL,
  ip_address   VARCHAR(45) NULL,
  created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (log_id),
  KEY idx_audit_user (user_id),
  KEY idx_audit_entity (entity_type, entity_id),
  KEY idx_audit_created (created_at),
  CONSTRAINT fk_audit_user FOREIGN KEY (user_id) REFERENCES users(user_id)
    ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB;

-- 11. system_settings
CREATE TABLE system_settings (
  setting_id     INT UNSIGNED NOT NULL AUTO_INCREMENT,
  setting_key    VARCHAR(80) NOT NULL,
  setting_value  VARCHAR(255) NOT NULL,
  description    VARCHAR(255) NULL,
  updated_by     INT UNSIGNED NULL,
  updated_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (setting_id),
  UNIQUE KEY uq_settings_key (setting_key),
  CONSTRAINT fk_settings_user FOREIGN KEY (updated_by) REFERENCES users(user_id)
    ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB;