import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import os from 'os';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const audioFile = formData.get('audio') as File;

    if (!audioFile) {
      return NextResponse.json({ error: 'Nenhum áudio recebido' }, { status: 400 });
    }

    // Salva arquivo temporariamente
    const tempDir = os.tmpdir();
    const tempFilePath = path.join(tempDir, `audio-${Date.now()}.webm`);
    const bytes = await audioFile.arrayBuffer();
    fs.writeFileSync(tempFilePath, Buffer.from(bytes));

    // Transcreve com Whisper (OpenAI)
    const transcription = await transcribeAudio(tempFilePath);

    // Limpa arquivo temporário
    fs.unlinkSync(tempFilePath);

    return NextResponse.json({ transcription });
  } catch (error) {
    console.error('Erro na transcrição:', error);
    return NextResponse.json({ error: 'Erro ao transcrever áudio' }, { status: 500 });
  }
}

async function transcribeAudio(filePath: string): Promise<string> {
  const formData = new FormData();
  formData.append('file', fs.createReadStream(filePath) as unknown as Blob);
  formData.append('model', 'whisper-1');
  formData.append('language', 'pt');

  const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: formData,
  });

  const data = await response.json();
  return data.text;
}
