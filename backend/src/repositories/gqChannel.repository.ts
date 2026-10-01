import { gq_channel } from "@prisma/client";
import { prisma } from "./prismaClient";

export interface UpsertChannelInput {
  bqPropertyId: number;
  cxChannelId: string;
  title: string;
  channel: string;
  currency: string | null;
  isActive: boolean;
}

/** Keyed on cx_channel_id (unique) - a channel already known locally gets its cached fields refreshed rather than duplicated. */
export async function upsertChannel(input: UpsertChannelInput): Promise<gq_channel> {
  return prisma.gq_channel.upsert({
    where: { cx_channel_id: input.cxChannelId },
    create: {
      bq_property_id: input.bqPropertyId,
      cx_channel_id: input.cxChannelId,
      title: input.title,
      channel: input.channel,
      currency: input.currency ?? "XXX",
      is_active: input.isActive,
    },
    update: {
      title: input.title,
      channel: input.channel,
      currency: input.currency ?? undefined,
      is_active: input.isActive,
      updated_at: new Date(),
    },
  });
}

export async function findChannelsByProperty(bqPropertyId: number): Promise<gq_channel[]> {
  return prisma.gq_channel.findMany({ where: { bq_property_id: bqPropertyId }, orderBy: { title: "asc" } });
}

export async function findChannelById(id: string): Promise<gq_channel | null> {
  return prisma.gq_channel.findUnique({ where: { id } });
}

export async function findChannelByCxId(cxChannelId: string): Promise<gq_channel | null> {
  return prisma.gq_channel.findUnique({ where: { cx_channel_id: cxChannelId } });
}

export async function setChannelActive(id: string, isActive: boolean): Promise<gq_channel> {
  return prisma.gq_channel.update({ where: { id }, data: { is_active: isActive, updated_at: new Date() } });
}
