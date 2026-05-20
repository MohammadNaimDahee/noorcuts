"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { Project, DataSource } from "@/types";
import { NoorLogo } from "./NoorLogo";
import { UserButton } from "@clerk/nextjs";

export function ProjectsHub() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newDataSource, setNewDataSource] = useState<DataSource>("quran.com");
  const [creating, setCreating] = useState(false);
  const [showCreate, setShowCreate] = useState(false);

  useEffect(() => {
    fetch("/api/projects")
      .then((r) => r.json())
      .then((data) => {
        setProjects(Array.isArray(data) ? data : []);
        setLoading(false);
      });
  }, []);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim(), description: newDesc.trim(), dataSource: newDataSource }),
      });
      const project = await res.json();
      router.push(`/projects/${project.id}`);
    } catch {
      setCreating(false);
    }
  };

  const handleDelete = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    if (!confirm("Delete this project and all its render history?")) return;
    await fetch(`/api/projects?id=${id}`, { method: "DELETE" });
    setProjects((prev) => prev.filter((p) => p.id !== id));
  };

  return (
    <div className="flex h-screen flex-col bg-[#0e0e1e] text-zinc-200">
      {/* Header */}
      <div className="flex h-14 shrink-0 items-center justify-between border-b border-[#2a2a4a] bg-[#16162a] px-6">
        <div className="flex items-center gap-3">
          <NoorLogo size={28} />
        </div>
        <UserButton
          appearance={{
            elements: { avatarBox: "h-8 w-8" },
          }}
        />
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl px-6 py-10">
          <div className="mb-8 flex items-end justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-white">Projects</h1>
              <p className="mt-1 text-sm text-zinc-500">
                Each project stores your surah, reciter, style, and render history.
              </p>
            </div>
            <button
              onClick={() => setShowCreate(!showCreate)}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 transition-colors"
            >
              New Project
            </button>
          </div>

          {/* Create form */}
          {showCreate && (
            <div className="mb-6 rounded-xl border border-[#2a2a4a] bg-[#16162a] p-5">
              <h3 className="mb-3 text-sm font-medium text-zinc-300">Create Project</h3>
              <div className="space-y-3">
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                  placeholder="Project name"
                  className="studio-input w-full"
                  autoFocus
                />
                <input
                  type="text"
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                  placeholder="Description (optional)"
                  className="studio-input w-full"
                />
                <div>
                  <label className="mb-1.5 block text-xs text-zinc-400">Data Source</label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setNewDataSource("quran.com")}
                      className={`flex-1 rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors ${
                        newDataSource === "quran.com"
                          ? "border-emerald-500 bg-emerald-500/10 text-emerald-400"
                          : "border-[#2a2a4a] bg-[#0f0f20] text-zinc-400 hover:border-zinc-600"
                      }`}
                    >
                      <div className="text-left">
                        <div>Quran.com API</div>
                        <div className="mt-0.5 text-[10px] font-normal opacity-60">All reciters, translations, live data</div>
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewDataSource("local")}
                      className={`flex-1 rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors hidden ${
                        newDataSource === "local"
                          ? "border-emerald-500 bg-emerald-500/10 text-emerald-400"
                          : "border-[#2a2a4a] bg-[#0f0f20] text-zinc-400 hover:border-zinc-600"
                      }`}
                    >
                      <div className="text-left">
                        <div>Local Data</div>
                        <div className="mt-0.5 text-[10px] font-normal opacity-60">Offline, 2 reciters, Sahih Intl</div>
                      </div>
                    </button>
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => { setShowCreate(false); setNewName(""); setNewDesc(""); }}
                    className="rounded-md px-4 py-1.5 text-sm text-zinc-400 hover:text-zinc-200"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCreate}
                    disabled={creating || !newName.trim()}
                    className="rounded-md bg-emerald-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-40"
                  >
                    {creating ? "Creating..." : "Create"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Projects grid */}
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <span className="h-6 w-6 animate-spin rounded-full border-2 border-emerald-500/30 border-t-emerald-500" />
            </div>
          ) : projects.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[#2a2a4a] py-20">
              <NoorLogo size={40} variant="mark" className="opacity-20 mb-4" />
              <p className="text-sm text-zinc-500">No projects yet</p>
              <p className="mt-1 text-xs text-zinc-600">
                Create a project to start generating Quran recitation videos.
              </p>
              <button
                onClick={() => setShowCreate(true)}
                className="mt-4 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500"
              >
                Create your first project
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {projects.map((p) => (
                <div
                  key={p.id}
                  onClick={() => router.push(`/projects/${p.id}`)}
                  className="group cursor-pointer rounded-xl border border-[#2a2a4a] bg-[#16162a] p-5 transition-all hover:border-emerald-500/30 hover:bg-[#1a1a30]"
                >
                  <div className="flex items-start justify-between">
                    <div className="min-w-0 flex-1">
                      <h3 className="text-sm font-medium text-zinc-200 truncate">{p.name}</h3>
                      {p.description && (
                        <p className="mt-0.5 text-xs text-zinc-500 truncate">{p.description}</p>
                      )}
                    </div>
                    <button
                      onClick={(e) => handleDelete(e, p.id)}
                      className="ml-3 shrink-0 rounded p-1 text-xs text-red-400/0 group-hover:text-red-400 hover:bg-red-500/10 transition-all"
                      title="Delete project"
                    >
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                  <div className="mt-3 flex items-center gap-3 text-[10px] text-zinc-600">
                    {p.surah ? (
                      <span className="rounded bg-[#0f0f20] px-1.5 py-0.5">
                        Surah {p.surah} : {p.ayahStart}-{p.ayahEnd}
                      </span>
                    ) : (
                      <span className="rounded bg-[#0f0f20] px-1.5 py-0.5">No source set</span>
                    )}
                    <span className="rounded bg-[#0f0f20] px-1.5 py-0.5">{p.format}</span>
                    <span className={`rounded px-1.5 py-0.5 ${p.dataSource === "quran.com" ? "bg-emerald-500/10 text-emerald-500" : "bg-[#0f0f20]"}`}>
                      {p.dataSource === "quran.com" ? "Quran.com" : "Local"}
                    </span>
                    <span className="ml-auto">{new Date(p.updatedAt).toLocaleDateString()}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
