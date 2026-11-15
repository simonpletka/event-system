-- The saved line-item categories, in the order quotes list them:
-- Video, Audio, Lighting, Accessories, People, Services.
-- Only the list in Settings changes. Quote and invoice items store their
-- category as plain text, so existing documents keep theirs (e.g. "Rigging").
DELETE FROM "ItemCategory";
INSERT INTO "ItemCategory" ("id", "name", "sortOrder") VALUES
  ('itemcat_video', 'Video', 0),
  ('itemcat_audio', 'Audio', 1),
  ('itemcat_lighting', 'Lighting', 2),
  ('itemcat_accessories', 'Accessories', 3),
  ('itemcat_people', 'People', 4),
  ('itemcat_services', 'Services', 5);
