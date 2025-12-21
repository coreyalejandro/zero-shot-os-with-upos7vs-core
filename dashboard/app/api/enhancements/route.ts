import { NextResponse } from "next/server";
import enhancements from "@/data/enhancements.json";

type Enhancement = (typeof enhancements)[number];

export async function GET() {
  return NextResponse.json(enhancements as Enhancement[]);
}
