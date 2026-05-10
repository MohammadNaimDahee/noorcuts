import { NextRequest, NextResponse } from "next/server";

const PEXELS_API_KEY = process.env.PEXELS_API_KEY;

interface PexelsVideoFile {
  id: number;
  quality: string;
  file_type: string;
  width: number;
  height: number;
  link: string;
}

interface PexelsVideo {
  id: number;
  width: number;
  height: number;
  duration: number;
  image: string;
  video_files: PexelsVideoFile[];
}

interface PexelsSearchResponse {
  page: number;
  per_page: number;
  total_results: number;
  videos: PexelsVideo[];
}

export async function GET(request: NextRequest) {
  if (!PEXELS_API_KEY) {
    return NextResponse.json(
      { error: "PEXELS_API_KEY not configured" },
      { status: 500 }
    );
  }

  const query = request.nextUrl.searchParams.get("q");
  const orientation = request.nextUrl.searchParams.get("orientation") || "portrait";
  const perPage = request.nextUrl.searchParams.get("per_page") || "15";
  const page = request.nextUrl.searchParams.get("page") || "1";

  if (!query) {
    return NextResponse.json(
      { error: "Query parameter 'q' is required" },
      { status: 400 }
    );
  }

  const url = new URL("https://api.pexels.com/videos/search");
  url.searchParams.set("query", query);
  url.searchParams.set("orientation", orientation);
  url.searchParams.set("per_page", perPage);
  url.searchParams.set("page", page);
  url.searchParams.set("size", "medium");

  const res = await fetch(url.toString(), {
    headers: { Authorization: PEXELS_API_KEY },
  });

  if (!res.ok) {
    const text = await res.text();
    return NextResponse.json(
      { error: `Pexels API error: ${res.status} ${text}` },
      { status: res.status }
    );
  }

  const data: PexelsSearchResponse = await res.json();

  // Transform to our BackgroundVideo format, picking the best HD file
  const videos = data.videos.map((v) => {
    // Prefer HD mp4, fallback to SD
    const hdFile = v.video_files.find(
      (f) => f.quality === "hd" && f.file_type === "video/mp4"
    );
    const sdFile = v.video_files.find(
      (f) => f.quality === "sd" && f.file_type === "video/mp4"
    );
    const file = hdFile || sdFile || v.video_files[0];

    return {
      id: String(v.id),
      url: file?.link || "",
      thumbnailUrl: v.image,
      duration: v.duration,
      width: file?.width || v.width,
      height: file?.height || v.height,
    };
  }).filter((v) => v.url);

  return NextResponse.json({
    videos,
    totalResults: data.total_results,
    page: data.page,
  });
}
