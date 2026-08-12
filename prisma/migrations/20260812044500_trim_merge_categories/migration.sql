-- Merge Magician into Magic, clear removed category flags
UPDATE "Person"
SET "magic" = CASE WHEN "magic" = 1 OR "magician" = 1 THEN 1 ELSE 0 END,
    "magician" = 0,
    "nmCreatorInLA" = 0,
    "losAngeles" = 0,
    "modifiedByRickLax" = 0;
