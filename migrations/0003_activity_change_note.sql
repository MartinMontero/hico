-- 0003 a short staff note on an activity that has changed (O-24, D-39): "Moved to 8 pm". Empty means nothing has changed.
-- Additive only: nothing is dropped or rewritten, and existing rows get the empty note. One column per line:
-- tests/node/migrations.test.ts parses this file.

ALTER TABLE activities ADD COLUMN change_note_en TEXT NOT NULL DEFAULT '' CHECK (length(change_note_en) <= 120);
ALTER TABLE activities ADD COLUMN change_note_fr TEXT NOT NULL DEFAULT '' CHECK (length(change_note_fr) <= 120);