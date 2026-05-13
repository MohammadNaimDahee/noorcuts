import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getProjects, createProject, getProject, updateProject, deleteProject } from "@/lib/db";

export async function GET(): Promise<NextResponse> {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json(await getProjects(userId));
}

export async function POST(request: Request): Promise<NextResponse> {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { name, description, dataSource } = body;

  if (!name || typeof name !== "string" || !name.trim()) {
    return NextResponse.json({ error: "Project name is required" }, { status: 400 });
  }

  const id = await createProject(userId, name.trim(), description, dataSource);
  const project = await getProject(id, userId);
  return NextResponse.json(project, { status: 201 });
}

export async function PUT(request: Request): Promise<NextResponse> {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { id, ...updates } = body;

  if (!id) {
    return NextResponse.json({ error: "Project id is required" }, { status: 400 });
  }

  const existing = await getProject(id, userId);
  if (!existing) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  await updateProject(id, userId, updates);
  const updated = await getProject(id, userId);
  return NextResponse.json(updated);
}

export async function DELETE(request: Request): Promise<NextResponse> {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "Project id is required" }, { status: 400 });
  }

  await deleteProject(parseInt(id, 10), userId);
  return NextResponse.json({ success: true });
}
