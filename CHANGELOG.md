# Changelog

## [6.0.0] - 2026-07-XX

### Added

- Added a cache layer to avoid repeated reads from disk and improve response times.
- Added cache validation based on file modification time and file size.
- Added support for a custom backup directory.
- Added an async version of the database for non-blocking operations.
- Added optional encryption support for stored data.
- Added backup versioning with filenames following the pattern backup_YYYY-MM-DD_HH-MM-SS-XXXXX.json.
- Added a CLI with commands for init, inspect, backup, restore, clear, get, set, remove, and has.
- Added richer database operations such as set, save, get, remove, clear, all, has, count, and find.
- Added event-based lifecycle support with ready and error events.
- Added operation events for get, set, remove, clear, writes, and backup creation.

### Changed

- Reworked the storage layer to support persistence, backup, logging, and encryption in a more structured way.
- Improved initialization so the base directory, backup directory, log directory, and database file are created automatically when missing.
- Standardized backup and logging behavior to be configurable through constructor options.
- The keys are now saved in alphabetic order.

### Fixed

- Fixed issues that caused repeated file reads when the database directory changed or the file state was updated.
- Fixed backup handling to keep the backup folder organized and avoid excessive backup accumulation.
- Improved validation to reject invalid database root structures.

### Performance Improvements

- Reduced unnecessary disk I/O by reusing cached data until the underlying file changes.
- Improved write and backup flow for faster and more predictable persistence operations.
