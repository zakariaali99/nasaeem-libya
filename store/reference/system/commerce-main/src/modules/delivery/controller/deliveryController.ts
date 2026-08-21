// src/modules/delivery/controller/deliveryController.ts

import { NextRequest, NextResponse } from "next/server";
import { validateRequest } from "@/lib/api-protection";
import { ROLES, PERMISSIONS } from "@/lib/rbac";
import * as deliveryService from "../services/deliveryService";
import { DeliveryMethodCode } from "../types/deliveryTypes";

// Cities
export async function getCities(req: NextRequest): Promise<NextResponse> {
  try {
    const url = new URL(req.url);
    const includeInactive = url.searchParams.get("admin") === "true";
    const cities = await deliveryService.listCities(includeInactive);
    return NextResponse.json({ message: "تم جلب المدن", data: cities }, { status: 200 });
  } catch (error) {
    console.error("Error fetching cities:", error);
    return NextResponse.json({ message: "خطأ في جلب المدن" }, { status: 500 });
  }
}

export async function getCity(req: NextRequest, { params }: { params: { cityId: string } }): Promise<NextResponse> {
  const { cityId } = params;
  if (!cityId) {
    return NextResponse.json({ message: "معرف المدينة غير صالح" }, { status: 400 });
  }
  try {
    const city = await deliveryService.getCity(cityId);
    if (!city) {
      return NextResponse.json({ message: "المدينة غير موجودة" }, { status: 404 });
    }
    return NextResponse.json({ message: "تم جلب المدينة", data: city }, { status: 200 });
  } catch (error) {
    console.error(`Error fetching city ${cityId}:`, error);
    return NextResponse.json({ message: "خطأ في جلب المدينة" }, { status: 500 });
  }
}

export async function createCity(req: NextRequest): Promise<NextResponse> {
  const authResult = await validateRequest(req, [...PERMISSIONS.MANAGE_INVENTORY]);
  try {
    const body = await req.json();
    const newCity = await deliveryService.createCity(body);
    return NextResponse.json({ message: "تم إنشاء المدينة", data: newCity }, { status: 201 });
  } catch (error) {
    console.error("Error creating city:", error);
    return NextResponse.json({ message: "خطأ في إنشاء المدينة" }, { status: 500 });
  }
}

export async function updateCity(req: NextRequest, { params }: { params: { cityId: string } }): Promise<NextResponse> {
  const authResult = await validateRequest(req, [...PERMISSIONS.MANAGE_INVENTORY]);
  if (!authResult.success) {
    return authResult.response;
  }
  const { cityId } = params;
  if (!cityId) {
    return NextResponse.json({ message: "معرف المدينة غير صالح" }, { status: 400 });
  }
  try {
    const body = await req.json();
    const updated = await deliveryService.updateCity(cityId, body);
    if (!updated) {
      return NextResponse.json({ message: "المدينة غير موجودة" }, { status: 404 });
    }
    return NextResponse.json({ message: "تم تحديث المدينة", data: updated }, { status: 200 });
  } catch (error) {
    console.error(`Error updating city ${cityId}:`, error);
    return NextResponse.json({ message: "خطأ في تحديث المدينة" }, { status: 500 });
  }
}

export async function deleteCity(req: NextRequest, { params }: { params: { cityId: string } }): Promise<NextResponse> {
  const authResult = await validateRequest(req, [...PERMISSIONS.MANAGE_INVENTORY]);
  if (!authResult.success) {
    return authResult.response;
  }
  const { cityId } = params;
  if (!cityId) {
    return NextResponse.json({ message: "معرف المدينة غير صالح" }, { status: 400 });
  }
  try {
    const deleted = await deliveryService.deleteCity(cityId);
    if (!deleted) {
      return NextResponse.json({ message: "المدينة غير موجودة أو فشل الحذف" }, { status: 404 });
    }
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error(`Error deleting city ${cityId}:`, error);
    return NextResponse.json({ message: "خطأ في حذف المدينة" }, { status: 500 });
  }
}

// Regions
export async function getRegions(req: NextRequest): Promise<NextResponse> {
  try {
    const url = new URL(req.url);
    const includeInactive = url.searchParams.get("admin") === "true";
    // استخراج معرف المدينة من عنوان URL
    const urlParts = req.url.split("/");
    const cityId = urlParts[urlParts.indexOf("cities") + 1];
    const regions = await deliveryService.listRegions(cityId, includeInactive);
    return NextResponse.json({ message: "تم جلب المناطق", data: regions }, { status: 200 });
  } catch (error) {
    console.error("Error fetching regions:", error);
    return NextResponse.json({ message: "خطأ في جلب المناطق" }, { status: 500 });
  }
}

export async function getRegion(req: NextRequest, { params }: { params: { regionId: string } }): Promise<NextResponse> {
  const { regionId } = params;
  if (!regionId) {
    return NextResponse.json({ message: "معرف المنطقة غير صالح" }, { status: 400 });
  }
  try {
    const region = await deliveryService.getRegion(regionId);
    if (!region) {
      return NextResponse.json({ message: "المنطقة غير موجودة" }, { status: 404 });
    }
    return NextResponse.json({ message: "تم جلب المنطقة", data: region }, { status: 200 });
  } catch (error) {
    console.error(`Error fetching region ${regionId}:`, error);
    return NextResponse.json({ message: "خطأ في جلب المنطقة" }, { status: 500 });
  }
}

export async function createRegion(req: NextRequest): Promise<NextResponse> {
  const authResult = await validateRequest(req, [...PERMISSIONS.MANAGE_INVENTORY]);
  if (!authResult.success) {
    return authResult.response;
  }
  try {
    const body = await req.json();
    const newRegion = await deliveryService.createRegion(body);
    return NextResponse.json({ message: "تم إنشاء المنطقة", data: newRegion }, { status: 201 });
  } catch (error) {
    console.error("Error creating region:", error);
    return NextResponse.json({ message: "خطأ في إنشاء المنطقة" }, { status: 500 });
  }
}

export async function updateRegion(req: NextRequest, { params }: { params: { regionId: string } }): Promise<NextResponse> {
  const authResult = await validateRequest(req, [...PERMISSIONS.MANAGE_INVENTORY]);
  if (!authResult.success) {
    return authResult.response;
  }
  const { regionId } = params;
  if (!regionId) {
    return NextResponse.json({ message: "معرف المنطقة غير صالح" }, { status: 400 });
  }
  try {
    const body = await req.json();
    const updated = await deliveryService.updateRegion(regionId, body);
    if (!updated) {
      return NextResponse.json({ message: "المنطقة غير موجودة" }, { status: 404 });
    }
    return NextResponse.json({ message: "تم تحديث المنطقة", data: updated }, { status: 200 });
  } catch (error) {
    console.error(`Error updating region ${regionId}:`, error);
    return NextResponse.json({ message: "خطأ في تحديث المنطقة" }, { status: 500 });
  }
}

export async function deleteRegion(req: NextRequest, { params }: { params: { regionId: string } }): Promise<NextResponse> {
  const authResult = await validateRequest(req, [...PERMISSIONS.MANAGE_INVENTORY]);
  if (!authResult.success) {
    return authResult.response;
  }
  const { regionId } = params;
  if (!regionId) {
    return NextResponse.json({ message: "معرف المنطقة غير صالح" }, { status: 400 });
  }
  try {
    const deleted = await deliveryService.deleteRegion(regionId);
    if (!deleted) {
      return NextResponse.json({ message: "المنطقة غير موجودة أو فشل الحذف" }, { status: 404 });
    }
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error(`Error deleting region ${regionId}:`, error);
    return NextResponse.json({ message: "خطأ في حذف المنطقة" }, { status: 500 });
  }
}

// Delivery Method Configurations
export async function listDeliveryMethodConfigs(req: NextRequest): Promise<NextResponse> {
  const authResult = await validateRequest(req, [...PERMISSIONS.MANAGE_INTEGRATIONS]);
  if (!authResult.success) {
    return authResult.response;
  }
  try {
    const configs = await deliveryService.listDeliveryMethodConfigs();
    return NextResponse.json({ message: "تم جلب طرق التوصيل", data: configs }, { status: 200 });
  } catch (error) {
    console.error("Error listing delivery method configs:", error);
    return NextResponse.json({ message: "خطأ في جلب طرق التوصيل" }, { status: 500 });
  }
}

export async function getDeliveryMethodConfig(req: NextRequest, { params }: { params: { configId: string } }): Promise<NextResponse> {
  const authResult = await validateRequest(req, [...PERMISSIONS.MANAGE_INTEGRATIONS]);
  if (!authResult.success) {
    return authResult.response;
  }
  const { configId } = params;
  if (!configId) {
    return NextResponse.json({ message: "معرف التكوين غير صالح" }, { status: 400 });
  }
  try {
    const config = await deliveryService.getDeliveryMethodConfig(configId);
    if (!config) {
      return NextResponse.json({ message: "التكوين غير موجود" }, { status: 404 });
    }
    return NextResponse.json({ message: "تم جلب التكوين", data: config }, { status: 200 });
  } catch (error) {
    console.error(`Error fetching config ${configId}:`, error);
    return NextResponse.json({ message: "خطأ في جلب التكوين" }, { status: 500 });
  }
}

export async function createDeliveryMethodConfig(req: NextRequest): Promise<NextResponse> {
  const authResult = await validateRequest(req, [...PERMISSIONS.MANAGE_INTEGRATIONS]);
  if (!authResult.success) {
    return authResult.response;
  }
  try {
    const body = await req.json();
    const newConfig = await deliveryService.createDeliveryMethodConfig(body);
    return NextResponse.json({ message: "تم إنشاء التكوين", data: newConfig }, { status: 201 });
  } catch (error) {
    console.error("Error creating delivery config:", error);
    return NextResponse.json({ message: "خطأ في إنشاء التكوين" }, { status: 500 });
  }
}

export async function updateDeliveryMethodConfig(req: NextRequest, { params }: { params: { configId: string } }): Promise<NextResponse> {
  const authResult = await validateRequest(req, [...PERMISSIONS.MANAGE_INTEGRATIONS]);
  if (!authResult.success) {
    return authResult.response;
  }
  const { configId } = params;
  if (!configId) {
    return NextResponse.json({ message: "معرف التكوين غير صالح" }, { status: 400 });
  }
  try {
    const body = await req.json();
    const updated = await deliveryService.updateDeliveryMethodConfig(configId, body);
    if (!updated) {
      return NextResponse.json({ message: "التكوين غير موجود" }, { status: 404 });
    }
    return NextResponse.json({ message: "تم تحديث التكوين", data: updated }, { status: 200 });
  } catch (error) {
    console.error(`Error updating config ${configId}:`, error);
    return NextResponse.json({ message: "خطأ في تحديث التكوين" }, { status: 500 });
  }
}

export async function deleteDeliveryMethodConfig(req: NextRequest, { params }: { params: { configId: string } }): Promise<NextResponse> {
  const authResult = await validateRequest(req, [...PERMISSIONS.MANAGE_INTEGRATIONS]);
  if (!authResult.success) {
    return authResult.response;
  }
  const { configId } = params;
  if (!configId) {
    return NextResponse.json({ message: "معرف التكوين غير صالح" }, { status: 400 });
  }
  try {
    const deleted = await deliveryService.deleteDeliveryMethodConfig(configId);
    if (!deleted) {
      return NextResponse.json({ message: "التكوين غير موجود أو فشل الحذف" }, { status: 404 });
    }
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error(`Error deleting config ${configId}:`, error);
    return NextResponse.json({ message: "خطأ في حذف التكوين" }, { status: 500 });
  }
}

// Orchestration
export async function calculateDeliveryPrice(req: NextRequest): Promise<NextResponse> {
  try {
    const { method, destinationCityId, destinationRegionId, orderDetails } = await req.json();
    const result = await deliveryService.calculateDeliveryPrice(
      method as DeliveryMethodCode,
      destinationCityId,
      destinationRegionId,
      orderDetails
    );
    return NextResponse.json({ message: "تم حساب تكلفة التوصيل", data: result }, { status: 200 });
  } catch (error) {
    console.error("Error calculating delivery price:", error);
    return NextResponse.json({ message: "خطأ في حساب تكلفة التوصيل" }, { status: 500 });
  }
}

export async function startDelivery(req: NextRequest): Promise<NextResponse> {
  const authResult = await validateRequest(req, [...PERMISSIONS.MANAGE_ORDERS]);
  if (!authResult.success) {
    return authResult.response;
  }
  try {
    const { method, params } = await req.json();
    const result = await deliveryService.startDelivery(
      method as DeliveryMethodCode,
      params
    );
    return NextResponse.json({ message: "تم بدء التوصيل", data: result }, { status: 200 });
  } catch (error) {
    console.error("Error starting delivery:", error);
    return NextResponse.json({ message: "خطأ في بدء التوصيل" }, { status: 500 });
  }
}