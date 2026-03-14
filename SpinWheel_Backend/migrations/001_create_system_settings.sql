IF OBJECT_ID('dbo.system_settings', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.system_settings (
    id INT IDENTITY(1,1) PRIMARY KEY,
    auto_start_seconds           INT NOT NULL,
    elimination_interval_seconds INT NOT NULL,
    min_participants             INT NOT NULL,
    created_by INT NULL,
    updated_by INT NOT NULL,
    created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    updated_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
  );
END
