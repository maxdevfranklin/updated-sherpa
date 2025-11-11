import { NextRequest, NextResponse } from "next/server";
import { FishAudioClient } from "fish-audio";

const fishAudioClient = new FishAudioClient({
  apiKey: process.env.FISH_API_KEY,
});

const streamToArrayBuffer = (stream: ReadableStream<Uint8Array>) => {
  return new Response(stream).arrayBuffer();
};

export async function POST(req: NextRequest) {
  try {
    const { text } = await req.json();

    if (!text || typeof text !== "string") {
      return NextResponse.json(
        { error: "text is required in the request body" },
        { status: 400 }
      );
    }

    const audioStream = await fishAudioClient.textToSpeech.convert(
      {
        text,
        reference_id: process.env.FISH_REFERENCE_ID,
        format: "pcm",
        chunk_length: 200,
        sample_rate: 16000,
        latency: "balanced",
      },
      "s1"
    );

    const audioArrayBuffer = await streamToArrayBuffer(audioStream);

    return new NextResponse(audioArrayBuffer, {
      status: 200,
      headers: {
        "Content-Type": "audio/pcm",
        "Content-Length": audioArrayBuffer.byteLength.toString(),
      },
    });
  } catch (error) {
    console.error("[Fish TTS] Error generating audio:", error);
    return NextResponse.json(
      { error: "Failed to generate audio" },
      { status: 500 }
    );
  }
}

