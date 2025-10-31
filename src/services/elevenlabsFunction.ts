// ElevenLabs TTS using direct HTTP API calls

export async function speak(text: string): Promise<Buffer | undefined> {
  console.log('\n[ElevenLabs] Bot speaking:', text);

  const ELEVENLABS_API_KEY = process.env.NEXT_PUBLIC_ELEVENLABS_API_KEY;
  const ELEVENLABS_VOICE_ID = process.env.NEXT_PUBLIC_ELEVENLABS_VOICE_ID;

  if (!ELEVENLABS_API_KEY || !ELEVENLABS_VOICE_ID) {
    console.error('[ElevenLabs] Missing API key or voice ID');
    return undefined;
  }

  const voiceSettings = {
    stability: 1,
    similarity_boost: 1,
    style: 0,
    use_speaker_boost: true,
  };

  try {
    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${ELEVENLABS_VOICE_ID}`, {
      method: 'POST',
      headers: {
        'Accept': 'audio/mpeg',
        'Content-Type': 'application/json',
        'xi-api-key': ELEVENLABS_API_KEY,
      },
      body: JSON.stringify({
        text,
        model_id: 'eleven_turbo_v2',
        voice_settings: voiceSettings,
        output_format: 'ulaw_8000',
      }),
    });

    if (!response.ok) {
      throw new Error(`ElevenLabs API error: ${response.status} ${response.statusText}`);
    }

    const audioBuffer = await response.arrayBuffer();
    return Buffer.from(audioBuffer);
  
  } catch (err) {
    console.error('[ElevenLabs] Error streaming speech:', err);
    return undefined;
  }
}