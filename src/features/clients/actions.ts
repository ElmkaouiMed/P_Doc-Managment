"use server";

import { prisma } from "@/lib/db";
import { getCompanyWriteAccessError, requireAuthContext } from "@/features/auth/lib/session";

type DeleteClientInput = {
  clientId: string;
};

type UpdateClientInput = {
  clientId: string;
  code?: string;
  name: string;
  email?: string;
  phone?: string;
  phoneFix?: string;
  address?: string;
  city?: string;
  country?: string;
  ice?: string;
  ifNumber?: string;
  notes?: string;
};

function cleanText(value: string | undefined) {
  const next = (value || "").trim();
  return next.length ? next : null;
}

export async function updateClientAction(input: UpdateClientInput) {
  const auth = await requireAuthContext();
  const writeAccessError = getCompanyWriteAccessError(auth);
  if (writeAccessError) {
    return { ok: false as const, error: writeAccessError };
  }
  const clientId = input.clientId.trim();
  if (!clientId) {
    return { ok: false as const, error: "Client id is required." };
  }

  const name = input.name.trim();
  if (!name) {
    return { ok: false as const, error: "Client name is required." };
  }

  const existing = await prisma.client.findFirst({
    where: {
      id: clientId,
      companyId: auth.company.id,
    },
    select: { id: true },
  });

  if (!existing) {
    return { ok: false as const, error: "Client not found." };
  }

  try {
    const client = await prisma.client.update({
      where: { id: existing.id },
      data: {
        code: cleanText(input.code),
        name,
        email: cleanText(input.email),
        phone: cleanText(input.phone),
        phoneFix: cleanText(input.phoneFix),
        address: cleanText(input.address),
        city: cleanText(input.city),
        country: cleanText(input.country),
        ice: cleanText(input.ice),
        ifNumber: cleanText(input.ifNumber),
        notes: cleanText(input.notes),
      },
      select: {
        id: true,
        code: true,
        name: true,
        email: true,
        phone: true,
        phoneFix: true,
        address: true,
        city: true,
        country: true,
        ice: true,
        ifNumber: true,
        notes: true,
        updatedAt: true,
      },
    });

    return {
      ok: true as const,
      client: {
        ...client,
        updatedAt: client.updatedAt.toISOString(),
      },
    };
  } catch {
    return {
      ok: false as const,
      error: "Unable to update this client.",
    };
  }
}

export async function deleteClientAction(input: DeleteClientInput) {
  const auth = await requireAuthContext();
  const writeAccessError = getCompanyWriteAccessError(auth);
  if (writeAccessError) {
    return { ok: false as const, error: writeAccessError };
  }
  const clientId = input.clientId.trim();
  if (!clientId) {
    return { ok: false as const, error: "Client id is required." };
  }

  const existing = await prisma.client.findFirst({
    where: {
      id: clientId,
      companyId: auth.company.id,
    },
    select: { id: true },
  });

  if (!existing) {
    return { ok: true as const };
  }

  try {
    await prisma.client.delete({
      where: { id: existing.id },
    });
    return { ok: true as const };
  } catch {
    return {
      ok: false as const,
      error: "Unable to delete this client. Remove linked payments first.",
    };
  }
}
