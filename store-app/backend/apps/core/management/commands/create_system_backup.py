from django.core.management.base import BaseCommand, CommandError

from apps.core import backup_service


class Command(BaseCommand):
    help = "Generates a full system backup ZIP archive containing database fixtures, manifest, and media assets."

    def handle(self, *args, **options):
        self.stdout.write("Generating full system backup...")
        try:
            result = backup_service.create_full_backup()
            self.stdout.write(
                self.style.SUCCESS(
                    f"Backup generated successfully!\n"
                    f"  File: {result.get('filename')}\n"
                    f"  Size: {result.get('size_mb')} MB ({result.get('size_bytes')} bytes)\n"
                    f"  Path: {result.get('filepath')}\n"
                    f"  Created: {result.get('created_at')}"
                )
            )
        except Exception as e:
            raise CommandError(f"Backup generation failed with error: {e}")
