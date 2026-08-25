"""API Views for System Backup & Restore Operations."""

from __future__ import annotations

import os
from pathlib import Path

from django.http import FileResponse, Http404
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from . import backup_service


class IsAdminOrOwner(permissions.BasePermission):
    """Only Admins and Owners can manage backups."""

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        return request.user.role in ("admin", "owner") or request.user.is_superuser


class AdminBackupListView(APIView):
    permission_classes = [IsAdminOrOwner]

    def get(self, request):
        stats = backup_service.get_system_stats()
        backups = backup_service.list_backups()
        return Response({
            "stats": stats,
            "backups": backups,
        })


class AdminBackupExportView(APIView):
    permission_classes = [IsAdminOrOwner]

    def post(self, request):
        try:
            backup_result = backup_service.create_full_backup()
            return Response(backup_result, status=status.HTTP_201_CREATED)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class AdminBackupDownloadView(APIView):
    permission_classes = [IsAdminOrOwner]

    def get(self, request, filename):
        safe_filename = os.path.basename(filename)
        backups_dir = backup_service.get_backups_dir()
        file_path = backups_dir / safe_filename

        if not file_path.exists() or not safe_filename.endswith(".zip"):
            raise Http404("ملف النسخة الاحتياطية غير موجود.")

        response = FileResponse(open(file_path, "rb"), as_attachment=True, filename=safe_filename)
        response["Content-Type"] = "application/zip"
        return response


class AdminBackupDeleteView(APIView):
    permission_classes = [IsAdminOrOwner]

    def delete(self, request, filename):
        success = backup_service.delete_backup(filename)
        if success:
            return Response({"deleted": True, "filename": filename})
        return Response({"error": "تعذر حذف الملف أو أنه غير موجود"}, status=status.HTTP_404_NOT_FOUND)


class AdminBackupRestoreView(APIView):
    permission_classes = [IsAdminOrOwner]

    def post(self, request):
        uploaded_file = request.FILES.get("file")
        filename = request.data.get("filename")

        if uploaded_file:
            # Save uploaded zip temporarily
            backups_dir = backup_service.get_backups_dir()
            temp_path = backups_dir / f"restore_temp_{uploaded_file.name}"
            with open(temp_path, "wb+") as destination:
                for chunk in uploaded_file.chunks():
                    destination.write(chunk)
            restore_target = temp_path
        elif filename:
            safe_name = os.path.basename(filename)
            restore_target = backup_service.get_backups_dir() / safe_name
        else:
            return Response({"error": "يرجى اختيار ملف نسخة احتياطية للاسترجاع."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            result = backup_service.restore_backup(restore_target)
            return Response(result)
        except Exception as e:
            return Response({"error": f"فشل استرجاع النسخة الاحتياطية: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        finally:
            if uploaded_file and temp_path.exists():
                try:
                    temp_path.unlink()
                except Exception:
                    pass
