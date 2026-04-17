-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('active', 'inactive', 'suspended');

-- CreateEnum
CREATE TYPE "RoleCode" AS ENUM ('admin', 'manager', 'employee');

-- CreateEnum
CREATE TYPE "BranchStatus" AS ENUM ('active', 'inactive');

-- CreateEnum
CREATE TYPE "EmploymentStatus" AS ENUM ('active', 'on_leave', 'terminated');

-- CreateEnum
CREATE TYPE "AssignmentType" AS ENUM ('primary', 'secondary', 'temporary');

-- CreateEnum
CREATE TYPE "DevicePlatform" AS ENUM ('ios', 'android', 'web');

-- CreateEnum
CREATE TYPE "AttendanceEventType" AS ENUM ('check_in', 'check_out');

-- CreateEnum
CREATE TYPE "AttendanceEventStatus" AS ENUM ('success', 'failed');

-- CreateEnum
CREATE TYPE "AttendanceSessionStatus" AS ENUM ('on_time', 'late', 'early_leave', 'overtime', 'missing_checkout', 'absent');

-- CreateEnum
CREATE TYPE "ValidationMethod" AS ENUM ('gps', 'wifi', 'gps_wifi', 'none');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('create', 'update', 'delete', 'override', 'login', 'logout');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "phone" TEXT,
    "status" "UserStatus" NOT NULL DEFAULT 'active',
    "last_login_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" UUID NOT NULL,
    "code" "RoleCode" NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_roles" (
    "user_id" UUID NOT NULL,
    "role_id" UUID NOT NULL,

    CONSTRAINT "user_roles_pkey" PRIMARY KEY ("user_id","role_id")
);

-- CreateTable
CREATE TABLE "branches" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "latitude" DECIMAL(10,7) NOT NULL,
    "longitude" DECIMAL(10,7) NOT NULL,
    "radius_meters" INTEGER NOT NULL DEFAULT 150,
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Ho_Chi_Minh',
    "status" "BranchStatus" NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "branches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "departments" (
    "id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "departments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employees" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "employee_code" TEXT NOT NULL,
    "department_id" UUID,
    "primary_branch_id" UUID NOT NULL,
    "employment_status" "EmploymentStatus" NOT NULL DEFAULT 'active',
    "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_branch_assignments" (
    "id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "assignment_type" "AssignmentType" NOT NULL DEFAULT 'secondary',
    "effective_from" DATE NOT NULL,
    "effective_to" DATE,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "employee_branch_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "branch_wifi_configs" (
    "id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "ssid" TEXT NOT NULL,
    "bssid" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "branch_wifi_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "branch_geofences" (
    "id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "center_lat" DECIMAL(10,7) NOT NULL,
    "center_lng" DECIMAL(10,7) NOT NULL,
    "radius_meters" INTEGER NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "branch_geofences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_devices" (
    "id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "device_fingerprint" TEXT NOT NULL,
    "platform" "DevicePlatform" NOT NULL,
    "device_name" TEXT,
    "app_version" TEXT,
    "is_trusted" BOOLEAN NOT NULL DEFAULT false,
    "last_seen_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "employee_devices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_schedules" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "start_time" TEXT NOT NULL,
    "end_time" TEXT NOT NULL,
    "grace_minutes" INTEGER NOT NULL DEFAULT 10,
    "overtime_after_minutes" INTEGER NOT NULL DEFAULT 60,
    "workdays" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "work_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_schedule_assignments" (
    "id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "schedule_id" UUID NOT NULL,
    "effective_from" DATE NOT NULL,
    "effective_to" DATE,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "work_schedule_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendance_sessions" (
    "id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "work_date" DATE NOT NULL,
    "check_in_at" TIMESTAMP(3),
    "check_out_at" TIMESTAMP(3),
    "worked_minutes" INTEGER,
    "overtime_minutes" INTEGER,
    "status" "AttendanceSessionStatus" NOT NULL DEFAULT 'on_time',
    "trust_score" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "attendance_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendance_events" (
    "id" UUID NOT NULL,
    "session_id" UUID,
    "employee_id" UUID NOT NULL,
    "branch_id" UUID,
    "device_id" UUID,
    "event_type" "AttendanceEventType" NOT NULL,
    "status" "AttendanceEventStatus" NOT NULL,
    "validation_method" "ValidationMethod" NOT NULL DEFAULT 'none',
    "trust_score" INTEGER NOT NULL,
    "latitude" DECIMAL(10,7),
    "longitude" DECIMAL(10,7),
    "accuracy_meters" INTEGER,
    "ssid" TEXT,
    "bssid" TEXT,
    "ip_address" TEXT,
    "risk_flags" JSONB,
    "reject_reason" TEXT,
    "device_meta" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attendance_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_attendance_summaries" (
    "id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "work_date" DATE NOT NULL,
    "status" "AttendanceSessionStatus" NOT NULL,
    "worked_minutes" INTEGER NOT NULL DEFAULT 0,
    "overtime_minutes" INTEGER NOT NULL DEFAULT 0,
    "late_minutes" INTEGER NOT NULL DEFAULT 0,
    "trust_score_avg" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "daily_attendance_summaries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "user_id" UUID,
    "action" "AuditAction" NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT,
    "before" JSONB,
    "after" JSONB,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_status_idx" ON "users"("status");

-- CreateIndex
CREATE UNIQUE INDEX "roles_code_key" ON "roles"("code");

-- CreateIndex
CREATE UNIQUE INDEX "branches_code_key" ON "branches"("code");

-- CreateIndex
CREATE INDEX "branches_status_idx" ON "branches"("status");

-- CreateIndex
CREATE INDEX "departments_branch_id_idx" ON "departments"("branch_id");

-- CreateIndex
CREATE UNIQUE INDEX "departments_branch_id_name_key" ON "departments"("branch_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "employees_user_id_key" ON "employees"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "employees_employee_code_key" ON "employees"("employee_code");

-- CreateIndex
CREATE INDEX "employees_primary_branch_id_idx" ON "employees"("primary_branch_id");

-- CreateIndex
CREATE INDEX "employees_department_id_idx" ON "employees"("department_id");

-- CreateIndex
CREATE INDEX "employees_employment_status_idx" ON "employees"("employment_status");

-- CreateIndex
CREATE INDEX "employee_branch_assignments_employee_id_effective_from_effe_idx" ON "employee_branch_assignments"("employee_id", "effective_from", "effective_to");

-- CreateIndex
CREATE INDEX "employee_branch_assignments_branch_id_idx" ON "employee_branch_assignments"("branch_id");

-- CreateIndex
CREATE INDEX "branch_wifi_configs_branch_id_is_active_idx" ON "branch_wifi_configs"("branch_id", "is_active");

-- CreateIndex
CREATE INDEX "branch_wifi_configs_bssid_idx" ON "branch_wifi_configs"("bssid");

-- CreateIndex
CREATE INDEX "branch_geofences_branch_id_is_active_idx" ON "branch_geofences"("branch_id", "is_active");

-- CreateIndex
CREATE INDEX "employee_devices_employee_id_idx" ON "employee_devices"("employee_id");

-- CreateIndex
CREATE UNIQUE INDEX "employee_devices_employee_id_device_fingerprint_key" ON "employee_devices"("employee_id", "device_fingerprint");

-- CreateIndex
CREATE INDEX "work_schedule_assignments_employee_id_effective_from_effect_idx" ON "work_schedule_assignments"("employee_id", "effective_from", "effective_to");

-- CreateIndex
CREATE INDEX "attendance_sessions_branch_id_work_date_idx" ON "attendance_sessions"("branch_id", "work_date");

-- CreateIndex
CREATE INDEX "attendance_sessions_work_date_status_idx" ON "attendance_sessions"("work_date", "status");

-- CreateIndex
CREATE UNIQUE INDEX "attendance_sessions_employee_id_work_date_key" ON "attendance_sessions"("employee_id", "work_date");

-- CreateIndex
CREATE INDEX "attendance_events_session_id_created_at_idx" ON "attendance_events"("session_id", "created_at");

-- CreateIndex
CREATE INDEX "attendance_events_employee_id_created_at_idx" ON "attendance_events"("employee_id", "created_at");

-- CreateIndex
CREATE INDEX "attendance_events_branch_id_created_at_idx" ON "attendance_events"("branch_id", "created_at");

-- CreateIndex
CREATE INDEX "attendance_events_status_created_at_idx" ON "attendance_events"("status", "created_at");

-- CreateIndex
CREATE INDEX "daily_attendance_summaries_branch_id_work_date_idx" ON "daily_attendance_summaries"("branch_id", "work_date");

-- CreateIndex
CREATE INDEX "daily_attendance_summaries_work_date_status_idx" ON "daily_attendance_summaries"("work_date", "status");

-- CreateIndex
CREATE UNIQUE INDEX "daily_attendance_summaries_employee_id_work_date_key" ON "daily_attendance_summaries"("employee_id", "work_date");

-- CreateIndex
CREATE INDEX "audit_logs_user_id_created_at_idx" ON "audit_logs"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_logs_entity_type_entity_id_idx" ON "audit_logs"("entity_type", "entity_id");

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "departments" ADD CONSTRAINT "departments_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_primary_branch_id_fkey" FOREIGN KEY ("primary_branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_branch_assignments" ADD CONSTRAINT "employee_branch_assignments_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_branch_assignments" ADD CONSTRAINT "employee_branch_assignments_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "branch_wifi_configs" ADD CONSTRAINT "branch_wifi_configs_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "branch_geofences" ADD CONSTRAINT "branch_geofences_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_devices" ADD CONSTRAINT "employee_devices_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_schedule_assignments" ADD CONSTRAINT "work_schedule_assignments_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_schedule_assignments" ADD CONSTRAINT "work_schedule_assignments_schedule_id_fkey" FOREIGN KEY ("schedule_id") REFERENCES "work_schedules"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_sessions" ADD CONSTRAINT "attendance_sessions_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_sessions" ADD CONSTRAINT "attendance_sessions_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_events" ADD CONSTRAINT "attendance_events_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "attendance_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_events" ADD CONSTRAINT "attendance_events_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "employee_devices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_attendance_summaries" ADD CONSTRAINT "daily_attendance_summaries_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_attendance_summaries" ADD CONSTRAINT "daily_attendance_summaries_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
