/*
 * ============================================================
 * 009 - Prepare ListingPhotos for JSON photo object
 * ============================================================
 * Stores all listing photos in one row as a JSON object.
 * ============================================================
 */

IF OBJECT_ID('dbo.ListingPhotos', 'U') IS NOT NULL
BEGIN
    IF EXISTS (
        SELECT 1
        FROM sys.indexes
        WHERE name = 'IX_ListingPhotos_ListingId'
          AND object_id = OBJECT_ID('dbo.ListingPhotos')
    )
    BEGIN
        DROP INDEX IX_ListingPhotos_ListingId ON dbo.ListingPhotos;
        PRINT 'Dropped IX_ListingPhotos_ListingId.';
    END

    IF COL_LENGTH('dbo.ListingPhotos', 'PhotoUrl') IS NOT NULL
    BEGIN
        ALTER TABLE dbo.ListingPhotos
        ALTER COLUMN PhotoUrl NVARCHAR(MAX) NOT NULL;

        PRINT 'Updated ListingPhotos.PhotoUrl to NVARCHAR(MAX).';
    END

    IF NOT EXISTS (
        SELECT 1
        FROM sys.indexes
        WHERE name = 'IX_ListingPhotos_ListingId'
          AND object_id = OBJECT_ID('dbo.ListingPhotos')
    )
    BEGIN
        CREATE NONCLUSTERED INDEX IX_ListingPhotos_ListingId
            ON dbo.ListingPhotos (ListingId, PhotoType, DisplayOrder);

        PRINT 'Recreated IX_ListingPhotos_ListingId.';
    END
END
GO
