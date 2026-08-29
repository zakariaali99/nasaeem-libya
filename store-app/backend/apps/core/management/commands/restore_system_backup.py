import sys
from pathlib import Path

from django.core.management.base import BaseCommand, CommandError

from apps.core import backup_service


class Command(BaseCommand):
    help = "Restores full system database and media assets from a backup ZIP archive."

    def add_arguments(self, parser):
        parser.add_argument(
            "zip_path",
            type=str,
            help="Path to the backup ZIP file (e.g. /path/to/nasaeem_backup_20260829_120000.zip)",
        )
        parser.add_argument(
            "--no-input",
            action="store_true",
            help="Skip confirmation prompt before restoring.",
        )

    def handle(self, *args, **options):
        zip_path_str = options["zip_path"]
        no_input = options.get("no_input", False)

        zip_path = Path(zip_path_str).resolve()
        if not zip_path.exists():
            raise CommandError(f"Backup file not found at: {zip_path}")

        if not zip_path.is_file() or zip_path.suffix.lower() != ".zip":
            raise CommandError(f"Specified file is not a valid .zip archive: {zip_path}")

        size_mb = round(zip_path.stat().st_size / (1024 * 1024), 2)
        self.stdout.write(
            self.style.WARNING(
                f"Preparing to restore backup from:\n"
                f"  File: {zip_path.name}\n"
                f"  Size: {size_mb} MB\n"
                f"  Path: {zip_path}\n"
                f"This will overwrite conflicting records and extract media assets."
            )
        )

        if not no_input:
            confirm = input("Are you sure you want to proceed with restore? [y/N]: ")
            if confirm.strip().lower() not in ["y", "yes"]:
                self.stdout.write(self.style.NOTICE("Restore cancelled by user."))
                sys.exit(0)

        self.stdout.write("Restoring database and extracting media assets...")
        try:
            result = backup_service.restore_backup(zip_path)
            self.stdout.write(
                self.style.SUCCESS(
                    f"System restore completed successfully!\n"
                    f"  Restored records: {result.get('restored_records_count', 0)}\n"
                    f"  Timestamp: {result.get('restored_at')}\n"
                    f"  Media assets restored to media/ folder."
                )
            )
        except Exception as e:
            raise CommandError(f"Restore failed with error: {e}")
