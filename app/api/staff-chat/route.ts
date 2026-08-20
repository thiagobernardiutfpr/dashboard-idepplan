import { asc } from "drizzle-orm";
import { ensureDashboardSchema, getDb } from "@/db";
import { staffMessages } from "@/db/schema";
import { isResponsibleName } from "@/lib/responsibles";

export const dynamic="force-dynamic";
const text=(v:unknown,m:number)=>typeof v==="string"?v.trim().slice(0,m):"";
export async function GET(){try{await ensureDashboardSchema();return Response.json({messages:await getDb().select().from(staffMessages).orderBy(asc(staffMessages.messageDate),asc(staffMessages.createdAt))});}catch(error){console.error(error);return Response.json({error:"Não foi possível carregar as conversas."},{status:500});}}
export async function POST(request:Request){try{const p=await request.json() as Record<string,unknown>,sender=text(p.sender,120),recipient=text(p.recipient,120),message=text(p.message,3000),messageDate=text(p.messageDate,10);if(!isResponsibleName(sender)||(recipient!=="Todos"&&!isResponsibleName(recipient))||!message||!/^\d{4}-\d{2}-\d{2}$/.test(messageDate))return Response.json({error:"Revise remetente, destinatário, data e mensagem."},{status:400});await ensureDashboardSchema();const [record]=await getDb().insert(staffMessages).values({id:crypto.randomUUID(),sender,recipient,message,messageDate}).returning();return Response.json({message:record},{status:201});}catch(error){console.error(error);return Response.json({error:"Não foi possível enviar a mensagem."},{status:500});}}
