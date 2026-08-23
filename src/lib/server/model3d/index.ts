import "server-only";
import { GenApiModel3DProvider } from "./genapi";
import { Neural4DModel3DProvider } from "./neural4d";
import type { Model3DVendor, VendorId } from "./types";
import { VENDOR_IDS } from "./types";

/**
 * Реестр вендоров и переключатель между ними.
 *
 * Переключение — одна строка в .env:
 *
 *     ACTIVE_3D_PROVIDER=genapi
 *
 * Код при этом не меняется. Значение читается на каждом запросе, а не
 * фиксируется при старте, поэтому на Vercel достаточно поменять переменную
 * и передеплоить — пересборка не нужна.
 */

const VENDORS: Record<VendorId, Model3DVendor> = {
  neural4d: new Neural4DModel3DProvider(),
  genapi: new GenApiModel3DProvider(),
};

const DEFAULT_VENDOR: VendorId = "neural4d";

/** Разбирает ACTIVE_3D_PROVIDER, не падая на опечатке. */
export function activeVendorId(): VendorId {
  const raw = process.env.ACTIVE_3D_PROVIDER?.trim().toLowerCase();
  if (!raw) return DEFAULT_VENDOR;
  if ((VENDOR_IDS as string[]).includes(raw)) return raw as VendorId;

  // Опечатка в имени вендора не должна ронять генерацию: тихо берём
  // значение по умолчанию, но пишем в лог — иначе переключение «не
  // сработало» и никто не понимает почему.
  console.warn(
    `[model3d] ACTIVE_3D_PROVIDER="${raw}" не распознан; ожидалось ${VENDOR_IDS.join(" | ")}. Используется ${DEFAULT_VENDOR}.`,
  );
  return DEFAULT_VENDOR;
}

export function getActiveVendor(): Model3DVendor {
  return VENDORS[activeVendorId()];
}

export type { Model3DVendor, VendorId } from "./types";
export { VENDOR_IDS } from "./types";
