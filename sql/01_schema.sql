-- ============================================================
-- MediaHub - Azure SQL Schema
-- COM682 CW2 - Muhammad Usman (10423177)
-- Matches CW1 ERD: Users, MediaItems, Comments, Favourites
-- ============================================================

-- Drop in reverse FK order (safe re-run during development)
IF OBJECT_ID('dbo.Favourites', 'U') IS NOT NULL DROP TABLE dbo.Favourites;
IF OBJECT_ID('dbo.Comments',   'U') IS NOT NULL DROP TABLE dbo.Comments;
IF OBJECT_ID('dbo.MediaItems', 'U') IS NOT NULL DROP TABLE dbo.MediaItems;
IF OBJECT_ID('dbo.Users',      'U') IS NOT NULL DROP TABLE dbo.Users;
GO

-- ------------------------------------------------------------
-- Users
-- ------------------------------------------------------------
CREATE TABLE dbo.Users (
    userId      UNIQUEIDENTIFIER  NOT NULL CONSTRAINT PK_Users PRIMARY KEY
                                  DEFAULT NEWID(),
    name        NVARCHAR(80)      NOT NULL,
    email       NVARCHAR(255)     NOT NULL,
    role        NVARCHAR(20)      NOT NULL
                                  CONSTRAINT DF_Users_role DEFAULT ('creator'),
    createdAt   DATETIME2(3)      NOT NULL
                                  CONSTRAINT DF_Users_createdAt DEFAULT SYSUTCDATETIME(),
    CONSTRAINT UQ_Users_email   UNIQUE (email),
    CONSTRAINT CK_Users_role    CHECK  (role IN ('creator','viewer','moderator','admin'))
);
GO

-- ------------------------------------------------------------
-- MediaItems
-- ------------------------------------------------------------
CREATE TABLE dbo.MediaItems (
    mediaId     UNIQUEIDENTIFIER  NOT NULL CONSTRAINT PK_MediaItems PRIMARY KEY
                                  DEFAULT NEWID(),
    ownerId     UNIQUEIDENTIFIER  NOT NULL,
    title       NVARCHAR(120)     NOT NULL,
    blobUrl     NVARCHAR(500)     NOT NULL,
    visibility  NVARCHAR(12)      NOT NULL
                                  CONSTRAINT DF_MediaItems_visibility DEFAULT ('public'),
    status      NVARCHAR(12)      NOT NULL
                                  CONSTRAINT DF_MediaItems_status DEFAULT ('pending'),
    createdAt   DATETIME2(3)      NOT NULL
                                  CONSTRAINT DF_MediaItems_createdAt DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_MediaItems_Users
        FOREIGN KEY (ownerId) REFERENCES dbo.Users(userId)
        ON DELETE CASCADE,
    CONSTRAINT CK_MediaItems_visibility
        CHECK (visibility IN ('public','unlisted','private')),
    CONSTRAINT CK_MediaItems_status
        CHECK (status IN ('pending','approved','rejected','removed'))
);
GO

CREATE INDEX IX_MediaItems_ownerId   ON dbo.MediaItems(ownerId);
CREATE INDEX IX_MediaItems_createdAt ON dbo.MediaItems(createdAt DESC);
CREATE INDEX IX_MediaItems_status    ON dbo.MediaItems(status);
GO

-- ------------------------------------------------------------
-- Comments
-- ------------------------------------------------------------
CREATE TABLE dbo.Comments (
    commentId   UNIQUEIDENTIFIER  NOT NULL CONSTRAINT PK_Comments PRIMARY KEY
                                  DEFAULT NEWID(),
    mediaId     UNIQUEIDENTIFIER  NOT NULL,
    userId      UNIQUEIDENTIFIER  NOT NULL,
    text        NVARCHAR(1000)    NOT NULL,
    createdAt   DATETIME2(3)      NOT NULL
                                  CONSTRAINT DF_Comments_createdAt DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_Comments_MediaItems
        FOREIGN KEY (mediaId) REFERENCES dbo.MediaItems(mediaId)
        ON DELETE CASCADE,
    CONSTRAINT FK_Comments_Users
        FOREIGN KEY (userId)  REFERENCES dbo.Users(userId)
        -- NOTE: NO ACTION here to avoid multiple cascade paths error
);
GO

CREATE INDEX IX_Comments_mediaId ON dbo.Comments(mediaId);
CREATE INDEX IX_Comments_userId  ON dbo.Comments(userId);
GO

-- ------------------------------------------------------------
-- Favourites (composite PK as per ERD)
-- ------------------------------------------------------------
CREATE TABLE dbo.Favourites (
    userId      UNIQUEIDENTIFIER  NOT NULL,
    mediaId     UNIQUEIDENTIFIER  NOT NULL,
    createdAt   DATETIME2(3)      NOT NULL
                                  CONSTRAINT DF_Favourites_createdAt DEFAULT SYSUTCDATETIME(),
    CONSTRAINT PK_Favourites PRIMARY KEY (userId, mediaId),
    CONSTRAINT FK_Favourites_Users
        FOREIGN KEY (userId)  REFERENCES dbo.Users(userId)
        ON DELETE CASCADE,
    CONSTRAINT FK_Favourites_MediaItems
        FOREIGN KEY (mediaId) REFERENCES dbo.MediaItems(mediaId)
        -- NOTE: NO ACTION to avoid multiple cascade paths
);
GO

CREATE INDEX IX_Favourites_mediaId ON dbo.Favourites(mediaId);
GO

-- ============================================================
-- Seed data (handy for the demo video - CRUD already populated)
-- ============================================================
DECLARE @u1 UNIQUEIDENTIFIER = NEWID();
DECLARE @u2 UNIQUEIDENTIFIER = NEWID();
DECLARE @m1 UNIQUEIDENTIFIER = NEWID();
DECLARE @m2 UNIQUEIDENTIFIER = NEWID();

INSERT INTO dbo.Users (userId, name, email, role) VALUES
    (@u1, 'Muhammad Usman', 'muhammad@mediahub.demo', 'admin'),
    (@u2, 'Demo Creator',   'creator@mediahub.demo', 'creator');

INSERT INTO dbo.MediaItems (mediaId, ownerId, title, blobUrl, visibility, status) VALUES
    (@m1, @u2, 'Sunset over Belfast', 'https://<storage>.blob.core.windows.net/media/sample1.jpg', 'public', 'approved'),
    (@m2, @u2, 'Coastal drone clip',  'https://<storage>.blob.core.windows.net/media/sample2.mp4', 'public', 'pending');

INSERT INTO dbo.Comments (mediaId, userId, text) VALUES
    (@m1, @u1, 'Great composition!');

INSERT INTO dbo.Favourites (userId, mediaId) VALUES
    (@u1, @m1);
GO

-- ============================================================
-- Quick sanity checks
-- ============================================================
SELECT COUNT(*) AS users      FROM dbo.Users;
SELECT COUNT(*) AS mediaItems FROM dbo.MediaItems;
SELECT COUNT(*) AS comments   FROM dbo.Comments;
SELECT COUNT(*) AS favourites FROM dbo.Favourites;
GO
