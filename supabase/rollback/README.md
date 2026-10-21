# Rollbacks

One file per migration that has one, named for it. New in Phase 2C,
because 2C is the first migration to change a constraint that existing
rows depend on rather than only adding something.

These are not run by anything automatically. They exist so that "we can
roll this back" is a tested claim rather than an assumption, and so the
statement that does the rolling back has been read before it is needed.
`scripts/test-migrations.sh` applies every migration to a throwaway local
database, rolls the last two back, and applies them again.

Two of them are not loss-free, and each says so at the top of the file.
Read the file before running it.
