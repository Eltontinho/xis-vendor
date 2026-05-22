import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const audioFile = formData.get('audio') as File;

    if (!audioFile) return NextResponse.json({ error: 'Sem áudio' }, { status: 400 });

    const formDataWhisper = new FormData();
    formDataWhisper.append('file', audioFile);
    formDataWhisper.append('model', 'whisper-1');
    formDataWhisper.append('language', 'pt');

    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: formDataWhisper,
    });

    const data = await response.json();

    if (data.text) {
      return NextResponse.json({ transcription: data.text });
    } else {
      return NextResponse.json({ error: 'Erro na transcrição' }, { status: 500 });
    }

  } catch (error) {
    console.error('[/api/transcribe]', error);
    return NextResponse.json({ error: 'Falha interna' }, { status: 500 });
  }
}
