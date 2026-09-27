from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.permissions import IsAdminOrOwner
from apps.core.models import BankAccount
from apps.core.serializers import BankAccountSerializer, StoreSettingsSerializer
from apps.core.store_settings import get_public_store_settings, get_store_settings


class PublicStoreSettingsView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        return Response({"data": get_public_store_settings()})


class AdminStoreSettingsView(APIView):
    permission_classes = [IsAdminOrOwner]

    def get(self, request):
        settings = get_store_settings()
        serializer = StoreSettingsSerializer(settings)
        return Response({"data": serializer.data})

    def put(self, request):
        settings = get_store_settings()
        serializer = StoreSettingsSerializer(settings, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response({
            "data": serializer.data,
            "message": "تم حفظ إعدادات المتجر بنجاح — سيظهر التغيير في كل المتجر فوراً",
        })


class AdminBankAccountListCreateView(APIView):
    permission_classes = [IsAdminOrOwner]

    def get(self, request):
        accounts = BankAccount.objects.all().order_by("sort_order", "bank_name")
        serializer = BankAccountSerializer(accounts, many=True)
        return Response({"data": serializer.data})

    def post(self, request):
        # The store publishes exactly one account; the existing one is edited.
        if BankAccount.objects.exists():
            return Response(
                {"message": "للمتجر حساب مصرفي واحد — عدّل الحساب الحالي بدلاً من إضافة حساب جديد"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        serializer = BankAccountSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        account = serializer.save()
        return Response(
            {"data": BankAccountSerializer(account).data, "message": "تمت إضافة الحساب المصرفي بنجاح"},
            status=status.HTTP_201_CREATED,
        )


class AdminBankAccountDetailView(APIView):
    permission_classes = [IsAdminOrOwner]

    def patch(self, request, pk):
        account = BankAccount.objects.filter(pk=pk).first()
        if not account:
            return Response({"message": "الحساب المصرفي غير موجود"}, status=status.HTTP_404_NOT_FOUND)
        serializer = BankAccountSerializer(account, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response({"data": serializer.data, "message": "تم تحديث الحساب المصرفي بنجاح"})

    def delete(self, request, pk):
        account = BankAccount.objects.filter(pk=pk).first()
        if not account:
            return Response({"message": "الحساب المصرفي غير موجود"}, status=status.HTTP_404_NOT_FOUND)
        account.delete()
        return Response({"message": "تم حذف الحساب المصرفي"}, status=status.HTTP_204_NO_CONTENT)
