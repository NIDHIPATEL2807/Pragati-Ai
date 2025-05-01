import { NextResponse } from "next/server";

export async function GET() {
  try {
    // Get the backend URL from environment variables or use default localhost
    const backendUrl =  "http://localhost:6000/api/news";
    
    console.log("Fetching from backend URL:", backendUrl);
    
    // Fetch news data from the Flask backend
    const response = await fetch(backendUrl, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
      // Use cache: 'no-store' to always fetch fresh data
      cache: "no-store",
      // Add next.js specific options
      next: { revalidate: 60 }, // Revalidate at most once every minute
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Backend error (${response.status}): ${errorText}`);
      return NextResponse.json(
        { error: `Backend error: ${response.statusText}` },
        { status: response.status }
      );
    }
    
    // Get the response from the backend
    const data = await response.json();
    
    // Return the news data to the client
    return NextResponse.json(data);
  } catch (error) {
    console.error("Error in research-news API route:", error);
    
    // If the error is due to the Flask API not running
    if (error instanceof Error && error.message.includes("ECONNREFUSED")) {
      return NextResponse.json(
        { error: "Cannot connect to news server. Please make sure the Flask backend is running." },
        { status: 503 }
      );
    }
    
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}   