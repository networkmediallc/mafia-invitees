-- Rename LA list and classify kinds: shortcut | event | archived
UPDATE "GuestList" SET "name" = 'LA Players', "kind" = 'shortcut' WHERE "slug" = 'los-angeles';
UPDATE "GuestList" SET "kind" = 'shortcut' WHERE "slug" = 'vegas';
UPDATE "GuestList" SET "kind" = 'archived' WHERE "slug" = 'archived';
UPDATE "GuestList" SET "kind" = 'event'
WHERE "kind" = 'ranked'
  AND "slug" NOT IN ('los-angeles', 'vegas', 'archived');
